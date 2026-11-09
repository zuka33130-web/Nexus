import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize Google GenAI client (Server-Side only)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// -------------------------------------------------------------
// 1. DYNAMIC REVERSE PROXY & BRIDGE INJECTOR
// -------------------------------------------------------------

// Injected bridge script that instruments the target web page in real-time
const RUNTIME_BRIDGE_SCRIPT = `
(function() {
  if (window.__EVO_BRIDGE_INJECTED__) return;
  window.__EVO_BRIDGE_INJECTED__ = true;
  console.log('[EVO Browser Bridge] Initialized on', window.location.href);

  // Flag to avoid intercepting when EVO itself dispatches an approved message
  var isEvoDispatching = false;

  // Deduplication tracking to prevent multiple triggers from keydown + click + submit
  var lastCapturedText = '';
  var lastCapturedTimestamp = 0;

  function isDuplicateOrRecent(text) {
    var now = Date.now();
    if (text === lastCapturedText && (now - lastCapturedTimestamp) < 1800) {
      return true;
    }
    lastCapturedText = text;
    lastCapturedTimestamp = now;
    return false;
  }

  function notifyHost(type, payload) {
    try {
      window.parent.postMessage({
        source: 'EVO_BRIDGE',
        type: type,
        url: window.location.href,
        timestamp: Date.now(),
        payload: payload
      }, '*');
    } catch(e) {
      console.warn('[EVO Bridge] Host notify failed', e);
    }
  }

  // Detect platform
  function detectPlatform() {
    var host = window.location.hostname;
    if (host.includes('chatgpt.com') || host.includes('openai.com')) return 'chatgpt';
    if (host.includes('claude.ai') || host.includes('anthropic.com')) return 'claude';
    if (host.includes('gemini.google.com')) return 'gemini';
    if (host.includes('localhost:11434')) return 'ollama';
    return 'generic';
  }

  var currentPlatform = detectPlatform();
  notifyHost('PAGE_LOADED', { platform: currentPlatform, title: document.title });

  function getActiveChatInput() {
    var active = document.activeElement;
    if (active && (active.tagName === 'TEXTAREA' || active.isContentEditable || active.getAttribute('role') === 'textbox' || active.classList.contains('ProseMirror'))) {
      return active;
    }
    return document.querySelector('#prompt-textarea, textarea, [contenteditable="true"], [role="textbox"], div.ProseMirror');
  }

  function interceptAndHalt(e, rawText, sourceEvent) {
    if (isEvoDispatching) {
      return; // Allow EVO's own programmatic dispatch to go through
    }
    if (!rawText || !rawText.trim()) return;

    var text = rawText.trim();
    if (isDuplicateOrRecent(text)) {
      // Prevent duplicate event propagation without re-notifying
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return;
    }

    console.log('[EVO Bridge] Intercepted user submission (' + sourceEvent + '), halting original execution.');

    // CRITICAL: Stop the event immediately to prevent the webpage from dispatching the unmediated message!
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    notifyHost('INPUT_PROMPT_CAPTURED', {
      platform: currentPlatform,
      prompt: text,
      sourceEvent: sourceEvent,
      source: 'proxy'
    });
  }

  // Hook into text inputs and prompt submission in capture phase
  function setupInputInterception() {
    // 1. Keydown (Enter without Shift)
    document.addEventListener('keydown', function(e) {
      if (isEvoDispatching) return;
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        var target = e.target;
        if (target && (target.tagName === 'TEXTAREA' || target.isContentEditable || target.getAttribute('role') === 'textbox' || target.classList.contains('ProseMirror'))) {
          var text = target.value || target.innerText || target.textContent || '';
          if (text.trim().length > 0) {
            interceptAndHalt(e, text, 'keydown');
          }
        }
      }
    }, true);

    // 2. Click on Send buttons
    document.addEventListener('click', function(e) {
      if (isEvoDispatching) return;
      var btn = e.target.closest('button, [role="button"]');
      if (btn) {
        var testId = btn.getAttribute('data-testid') || '';
        var ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        var isSend = 
          testId === 'send-button' ||
          ariaLabel.includes('send') ||
          ariaLabel.includes('enviar') ||
          ariaLabel.includes('prompt') ||
          btn.type === 'submit' ||
          (btn.closest('form') && btn.closest('form').querySelector('textarea, [contenteditable="true"]'));

        if (isSend) {
          var inputField = getActiveChatInput() || (btn.closest('form') ? btn.closest('form').querySelector('textarea, [contenteditable="true"]') : null);
          if (inputField) {
            var text = inputField.value || inputField.innerText || inputField.textContent || '';
            if (text.trim().length > 0) {
              interceptAndHalt(e, text, 'click');
            }
          }
        }
      }
    }, true);

    // 3. Form submit event
    document.addEventListener('submit', function(e) {
      if (isEvoDispatching) return;
      var inputField = getActiveChatInput() || (e.target.querySelector ? e.target.querySelector('textarea, [contenteditable="true"], [role="textbox"]') : null);
      if (inputField) {
        var text = inputField.value || inputField.innerText || inputField.textContent || '';
        if (text.trim().length > 0) {
          interceptAndHalt(e, text, 'submit');
        }
      }
    }, true);
  }

  // Hook into window.fetch for streaming response capture
  var origFetch = window.fetch;
  window.fetch = async function() {
    var args = Array.prototype.slice.call(arguments);
    var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
    
    // Check if this looks like an AI completion endpoint
    var isAiEndpoint = url.includes('conversation') || url.includes('completion') || url.includes('chat') || url.includes('stream');
    
    var response = await origFetch.apply(this, args);
    
    if (isAiEndpoint && response && response.body && typeof response.body.tee === 'function') {
      try {
        var parts = response.body.tee();
        var streamToConsume = parts[1];
        var reader = streamToConsume.getReader();
        var decoder = new TextDecoder();
        var accumulated = '';

        (async function readStream() {
          while (true) {
            var res = await reader.read();
            if (res.done) {
              notifyHost('STREAM_COMPLETED', {
                platform: currentPlatform,
                fullText: accumulated
              });
              break;
            }
            var chunk = decoder.decode(res.value, { stream: true });
            accumulated += chunk;
            notifyHost('STREAM_CHUNK', {
              platform: currentPlatform,
              chunk: chunk,
              accumulatedLength: accumulated.length
            });
          }
        })().catch(function(err) {
          console.warn('[EVO Bridge] Stream tap error', err);
        });

        // Return original stream to page unchanged
        return new Response(parts[0], {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      } catch(e) {
        return response;
      }
    }
    return response;
  };

  // Listen to instructions from EVO Browser Host
  window.addEventListener('message', function(event) {
    if (!event.data || event.data.target !== 'EVO_BRIDGE') return;
    var data = event.data;

    if (data.action === 'INJECT_OPTIMIZED_PROMPT') {
      // Set dispatching flag so our own injected events aren't intercepted in a loop
      isEvoDispatching = true;
      console.log('[EVO Bridge] Injecting approved prompt:', data.prompt.slice(0, 40));

      var textarea = getActiveChatInput();
      if (textarea) {
        if (textarea.isContentEditable) {
          textarea.innerText = data.prompt;
        } else {
          textarea.value = data.prompt;
        }
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        
        if (data.autoSubmit) {
          setTimeout(function() {
            var submitBtn = document.querySelector('button[data-testid="send-button"], button[aria-label*="Send"], button[aria-label*="Enviar"], form button[type="submit"]');
            if (submitBtn) {
              submitBtn.click();
            } else {
              // Trigger Enter key event
              textarea.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true
              }));
            }

            // Release dispatching flag after submission completes
            setTimeout(function() {
              isEvoDispatching = false;
            }, 800);
          }, 150);
        } else {
          isEvoDispatching = false;
        }
      } else {
        isEvoDispatching = false;
      }
    } else if (data.action === 'CANCEL_PENDING_PROMPT') {
      console.log('[EVO Bridge] Pending prompt cancelled by user.');
      isEvoDispatching = false;
    }
  });

  setupInputInterception();
})();
`;

// GET /api/proxy/browse?url=...
app.get('/api/proxy/browse', async (req: Request, res: Response): Promise<void> => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    res.status(400).send('Missing target URL');
    return;
  }

  try {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
    } catch {
      res.status(400).send('Invalid URL format');
      return;
    }

    const response = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
    });

    const contentType = response.headers.get('content-type') || '';

    // If it's not HTML (e.g. image, binary, json), pipe through
    if (!contentType.includes('text/html')) {
      const arrayBuffer = await response.arrayBuffer();
      res.setHeader('Content-Type', contentType);
      res.send(Buffer.from(arrayBuffer));
      return;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Strip frame-busting scripts and anti-embed metatags
    $('meta[http-equiv="Content-Security-Policy"]').remove();
    $('meta[http-equiv="X-Frame-Options"]').remove();

    // Ensure base tag is set so relative assets resolve
    if ($('base').length === 0) {
      $('head').prepend(`<base href="${parsedUrl.origin}/">`);
    }

    // Injected bridge script
    $('head').append(`<script id="evo-runtime-bridge">${RUNTIME_BRIDGE_SCRIPT}</script>`);

    // Remove headers that prevent iframe embedding
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('Content-Security-Policy-Report-Only');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-EVO-Proxy', 'Active');
    res.setHeader('X-EVO-Target', parsedUrl.toString());

    res.send($.html());
  } catch (error: any) {
    console.error('[Proxy Error]', error?.message || error);
    res.status(502).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: system-ui, sans-serif; background: #090d16; color: #f1f5f9; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #111827; border: 1px solid #1f2937; padding: 32px; border-radius: 12px; max-width: 600px; text-align: center; }
            h2 { color: #f87171; margin-top: 0; }
            p { color: #94a3b8; line-height: 1.6; }
            .btn { background: #3b82f6; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; display: inline-block; margin-top: 16px; font-weight: 500; cursor: pointer; border: none; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Error al cargar la página a través del Proxy</h2>
            <p>No se pudo conectar con <strong>${targetUrl}</strong>. Causa: ${error?.message || 'Host inalcanzable o bloqueo de conexión'}.</p>
            <p>EVO Browser cuenta además con el <strong>Workstation AI Interactivo Integrado</strong> y el <strong>Adaptador Directo de APIs</strong> para interactuar sin depender de cortafuegos remotos.</p>
            <button class="btn" onclick="window.location.reload()">Reintentar conexión</button>
          </div>
        </body>
      </html>
    `);
  }
});

// -------------------------------------------------------------
// 2. AI MEDIATION ENGINE (Gemini 3.8 Flash Server-Side)
// -------------------------------------------------------------

// POST /api/mediation/analyze-input
// Analyzes user prompt against EVO Memory project goals & constraints,
// extracts intent, removes redundancy, and crafts an enriched prompt.
app.post('/api/mediation/analyze-input', async (req: Request, res: Response): Promise<void> => {
  try {
    const { rawPrompt, projectContext, recentTurns, autonomyLevel } = req.body;

    if (!rawPrompt || typeof rawPrompt !== 'string') {
      res.status(400).json({ error: 'rawPrompt string is required' });
      return;
    }

    const goals = projectContext?.permanentGoals?.join('\n- ') || 'Ninguno especificado';
    const constraints = projectContext?.strictConstraints?.join('\n- ') || 'Ninguna especificada';
    const techStack = projectContext?.techStack?.join(', ') || 'No especificado';
    const decisions = projectContext?.decisionLog?.map((d: any) => `- ${d.decision}: ${d.rationale}`).join('\n') || 'Sin decisiones previas';

    const systemInstruction = `
Eres el Motor Inteligente de Mediación de EVO BROWSER. Tu función es optimizar la comunicación entre el usuario y las IA (ChatGPT, Claude, Gemini).
Debes analizar el prompt del usuario y aplicar las directivas de EVO MEMORY:
1. Identificar la intención real y el objetivo concreto.
2. Eliminar ambigüedades, preámbulos superfluos y preguntas redundantes.
3. Incorporar de forma concisa y quirúrgica las restricciones del proyecto y las directivas permanentes relevantes sin inflar los tokens.
4. Reducir el consumo de tokens manteniendo el máximo rigor técnico.

Responde ÚNICAMENTE en formato JSON con la siguiente estructura exacta:
{
  "clarifiedIntent": "string resumen de la intención principal",
  "missingRequirements": ["lista de requisitos que faltan o están implícitos"],
  "injectedConstraints": ["restricciones de EVO Memory inyectadas"],
  "removedRedundancy": ["elementos superfluos eliminados"],
  "optimizedPrompt": "string con el prompt optimizado y enriquecido listo para la IA",
  "reasonForIntervention": "explicación clara de por qué se intervino el mensaje",
  "rawTokensEstimated": number,
  "optimizedTokensEstimated": number,
  "savingsPct": number
}
`;

    const userContent = `
PROYECTO ACTIVO EN EVO MEMORY:
- Nombre: ${projectContext?.name || 'General'}
- Stack Tecnológico: ${techStack}
- Objetivos Permanentes:
- ${goals}
- Restricciones Estrictas:
- ${constraints}
- Decisiones Clave Registradas:
${decisions}

MENSAJE ORIGINAL DEL USUARIO A LA IA:
"""
${rawPrompt}
"""

NIVEL DE AUTONOMÍA: ${autonomyLevel || 'assistance'}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userContent,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const jsonText = response.text || '{}';
    let parsedResult;
    try {
      parsedResult = JSON.parse(jsonText);
    } catch {
      parsedResult = {
        clarifiedIntent: 'Consulta directa',
        optimizedPrompt: rawPrompt,
        reasonForIntervention: 'Sin cambios requeridos',
        rawTokensEstimated: Math.ceil(rawPrompt.length / 4),
        optimizedTokensEstimated: Math.ceil(rawPrompt.length / 4),
        savingsPct: 0,
      };
    }

    res.json({
      success: true,
      original: rawPrompt,
      analysis: parsedResult,
    });
  } catch (error: any) {
    console.error('[Mediation Analyze Input Error]', error);
    res.status(500).json({
      error: 'Error en mediación inteligente',
      details: error?.message || String(error),
    });
  }
});

// POST /api/mediation/analyze-output
// Analyzes LLM output for circular reasoning, repetitive failed solutions, hallucinations
app.post('/api/mediation/analyze-output', async (req: Request, res: Response): Promise<void> => {
  try {
    const { rawOutput, conversationTurns, projectContext } = req.body;

    if (!rawOutput) {
      res.status(400).json({ error: 'rawOutput is required' });
      return;
    }

    const pastTurns = Array.isArray(conversationTurns) ? conversationTurns.slice(-6) : [];
    const constraints = projectContext?.strictConstraints || [];

    const systemInstruction = `
Eres el Detector Antibucle y Antierrores de EVO BROWSER.
Tu tarea es examinar la respuesta que la IA acaba de entregar y determinar:
1. Si contiene razonamiento circular o repite una solución que ya falló en turnos anteriores.
2. Si viola alguna de las restricciones estrictas del proyecto.
3. Si la IA no está progresando o está atascada en el mismo patrón de error.

Responde ÚNICAMENTE en JSON:
{
  "isLoop": boolean,
  "confidence": number (de 0 a 1),
  "reason": "explicación clara del bucle o error detectado, o cadena vacía si todo es correcto",
  "repetitionCount": number (veces que se ha intentado la misma idea fallida),
  "violatesConstraints": boolean,
  "violatedConstraintsList": ["string"],
  "suggestedBreakout": "propuesta específica de instrucción correctiva para sacar a la IA del bucle (Break-the-Loop)"
}
`;

    const userContent = `
RESTRICCIONES ESTRICTAS DEL PROYECTO:
${JSON.stringify(constraints, null, 2)}

TURNOS PREVIOS DE LA CONVERSACIÓN:
${JSON.stringify(pastTurns, null, 2)}

RESPUESTA RECIENTE DE LA IA A EVALUAR:
"""
${typeof rawOutput === 'string' ? rawOutput.slice(0, 4000) : JSON.stringify(rawOutput).slice(0, 4000)}
"""
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userContent,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({
      success: true,
      loopAnalysis: parsed,
    });
  } catch (error: any) {
    console.error('[Mediation Analyze Output Error]', error);
    res.status(500).json({
      error: 'Error analizando salida de IA',
      details: error?.message || String(error),
    });
  }
});

// POST /api/mediation/break-loop
// Generates an authoritative Break-the-Loop prompt instruction
app.post('/api/mediation/break-loop', async (req: Request, res: Response): Promise<void> => {
  try {
    const { loopReason, failedSolution, projectGoals } = req.body;

    const systemInstruction = `
Eres el Especialista en Desbloqueo Cognitivo de EVO BROWSER.
Genera una instrucción quirúrgica, asertiva y directa dirigida a la IA para obligarla a detener el bucle de razonamiento repetitivo y abordar el problema desde una perspectiva completamente diferente.
`;

    const prompt = `
MOTIVO DEL BUCLE DETECTADO: ${loopReason}
SOLUCIÓN FALLIDA QUE SE ESTABA REPITIENDO: ${failedSolution}
OBJETIVO DEL PROYECTO: ${projectGoals || 'Resolver la tarea sin repetir el error previo'}

Genera el mensaje correctivo "Break-the-Loop" que el usuario enviará a la IA. Sé directo, técnico y prohíbe explícitamente reintentar la estrategia fallida.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: { systemInstruction },
    });

    res.json({
      success: true,
      breakoutPrompt: response.text?.trim() || 'Detén este enfoque repetitivo. Analicemos la causa raíz desde una perspectiva diferente.',
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error generating breakout' });
  }
});

// -------------------------------------------------------------
// 3. DIRECT AI & LOCAL OLLAMA INTEGRATION ADAPTERS
// -------------------------------------------------------------

// GET /api/ai/ollama/status
app.get('/api/ai/ollama/status', async (req: Request, res: Response): Promise<void> => {
  const endpoint = (req.query.endpoint as string) || 'http://localhost:11434';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    
    const resp = await fetch(`${endpoint}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (resp.ok) {
      const data = await resp.json();
      res.json({ online: true, endpoint, models: data.models || [] });
    } else {
      res.json({ online: false, endpoint, error: `HTTP ${resp.status}` });
    }
  } catch (e: any) {
    res.json({ online: false, endpoint, error: e?.message || 'Ollama offline o no detectado en localhost:11434' });
  }
});

// POST /api/ai/direct-chat
// Direct chat route with streaming support or full response via Gemini 3.8 Flash
app.post('/api/ai/direct-chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, history = [], systemPrompt } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const contents = [];
    if (Array.isArray(history) && history.length > 0) {
      for (const turn of history) {
        contents.push({
          role: turn.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: turn.content }],
        });
      }
    }
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction: systemPrompt || 'Eres un asistente técnico de alta precisión integrado en EVO Browser.',
      },
    });

    res.json({
      success: true,
      reply: response.text || '',
    });
  } catch (error: any) {
    console.error('[Direct Chat Error]', error);
    res.status(500).json({
      error: 'Error en chat directo',
      details: error?.message || String(error),
    });
  }
});

// -------------------------------------------------------------
// 4. VITE MIDDLEWARE & STATIC ASSET SERVING
// -------------------------------------------------------------

async function bootstrap() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[EVO Browser Engine] Listening on port ${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start EVO server:', err);
  process.exit(1);
});
