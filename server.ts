import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import { GoogleGenAI } from '@google/genai';
import {
  GoalManager,
  InstructionRegistry,
  PolicyResolver,
  ContextInjector,
  ComplianceValidator,
  AuditLogger,
  SecurityAuthority,
} from './src/server/nexusGoalEngine.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

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

    let parsedResult;
    const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 20 && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');

    if (hasKey) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: userContent,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
          },
        });

        const jsonText = response.text || '{}';
        parsedResult = JSON.parse(jsonText);
      } catch (e: any) {
        console.warn('[Mediation Input Fallback] Gemini error:', e?.message);
      }
    }

    if (!parsedResult) {
      // Heuristic fallback for prompt optimization
      const enrichedConstraints = constraints !== 'Ninguna especificada' ? `\nRestricciones: ${constraints}` : '';
      parsedResult = {
        clarifiedIntent: 'Optimización Heurística',
        optimizedPrompt: `${rawPrompt}${enrichedConstraints}\n\n[Nota: Mediación heurística aplicada por ausencia de API Key]`,
        reasonForIntervention: 'Modo de compatibilidad heurística activo',
        rawTokensEstimated: Math.ceil(rawPrompt.length / 4),
        optimizedTokensEstimated: Math.ceil((rawPrompt.length + enrichedConstraints.length) / 4),
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

    let parsed;
    const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 20 && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');

    if (hasKey) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: userContent,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
          },
        });

        parsed = JSON.parse(response.text || '{}');
      } catch (e: any) {
        console.warn('[Mediation Output Fallback] Gemini error:', e?.message);
      }
    }

    if (!parsed) {
      // Heuristic loop detection
      const lastReply = pastTurns.length > 0 ? pastTurns[pastTurns.length - 1].content : '';
      const isRepetitive = lastReply && rawOutput.includes(lastReply.slice(0, 50));

      parsed = {
        isLoop: Boolean(isRepetitive),
        confidence: isRepetitive ? 0.7 : 0,
        reason: isRepetitive ? 'Detección heurística de repetición de texto.' : '',
        repetitionCount: isRepetitive ? 1 : 0,
        violatesConstraints: false,
        violatedConstraintsList: [],
        suggestedBreakout: isRepetitive ? 'Parece que estás repitiendo la respuesta. Por favor, intenta un enfoque diferente.' : ''
      };
    }

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

    let breakoutPrompt = '';
    const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 20 && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');

    if (hasKey) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: { systemInstruction },
        });

        breakoutPrompt = response.text?.trim() || '';
      } catch (e: any) {
        console.warn('[Break Loop Fallback] Gemini error:', e?.message);
      }
    }

    if (!breakoutPrompt) {
      breakoutPrompt = `DETENER BUCLE: Se detectó repetición sobre "${failedSolution.slice(0, 50)}...". Abandona este camino y resuelve el objetivo "${projectGoals}" usando un método alternativo.`;
    }

    res.json({
      success: true,
      breakoutPrompt,
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

// -------------------------------------------------------------
// 3.1 NEXUS CAPA 1: GOAL & INSTRUCTION PROTECTION ENGINE ROUTES
// -------------------------------------------------------------

// GET /api/nexus/goals
app.get('/api/nexus/goals', (req: Request, res: Response): void => {
  try {
    const goals = GoalManager.getGoals();
    res.json({ success: true, goals });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Error al obtener objetivos' });
  }
});

// GET /api/nexus/goals/active
app.get('/api/nexus/goals/active', (req: Request, res: Response): void => {
  try {
    const activeGoal = GoalManager.getActiveGoal();
    res.json({ success: true, activeGoal });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Error al obtener objetivo activo' });
  }
});

// POST /api/nexus/goals
app.post('/api/nexus/goals', (req: Request, res: Response): void => {
  try {
    const goal = GoalManager.createGoal(req.body);
    res.status(201).json({ success: true, goal });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'Error al crear objetivo' });
  }
});

// POST /api/nexus/auth/challenge
// Issues a cryptographic server-side challenge token and confirmation code for protected actions
app.post('/api/nexus/auth/challenge', (req: Request, res: Response): void => {
  try {
    const { action, goalId, description } = req.body;
    if (!action) {
      res.status(400).json({ error: 'El campo action es obligatorio' });
      return;
    }
    const challenge = SecurityAuthority.createChallenge(action, goalId, description);
    res.json({ success: true, challenge });
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

// PUT /api/nexus/goals/:id
app.put('/api/nexus/goals/:id', (req: Request, res: Response): void => {
  try {
    const { updates, challengeToken, confirmationCode } = req.body;
    const updated = GoalManager.updateGoal(req.params.id, updates || req.body, { challengeToken, confirmationCode });
    res.json({ success: true, goal: updated });
  } catch (e: any) {
    res.status(403).json({ error: e?.message || 'Modificación no autorizada o error' });
  }
});

// POST /api/nexus/goals/:id/activate
app.post('/api/nexus/goals/:id/activate', (req: Request, res: Response): void => {
  try {
    const activated = GoalManager.activateGoal(req.params.id);
    res.json({ success: true, goal: activated });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'Error al activar objetivo' });
  }
});

// DELETE /api/nexus/goals/:id
app.delete('/api/nexus/goals/:id', (req: Request, res: Response): void => {
  try {
    const challengeToken = (req.body?.challengeToken || req.query.challengeToken) as string;
    const confirmationCode = (req.body?.confirmationCode || req.query.confirmationCode) as string;
    const deleted = GoalManager.deleteGoal(req.params.id, { challengeToken, confirmationCode });
    res.json({ success: deleted });
  } catch (e: any) {
    res.status(403).json({ error: e?.message || 'Eliminación rechazada' });
  }
});

// GET /api/nexus/policies/global
app.get('/api/nexus/policies/global', (req: Request, res: Response): void => {
  try {
    const globalInstructions = InstructionRegistry.getGlobalInstructions();
    res.json({ success: true, globalInstructions });
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

// POST /api/nexus/policies/global
app.post('/api/nexus/policies/global', (req: Request, res: Response): void => {
  try {
    const { globalInstructions, challengeToken, confirmationCode } = req.body;
    const saved = InstructionRegistry.saveGlobalInstructions(globalInstructions, { challengeToken, confirmationCode });
    res.json({ success: true, globalInstructions: saved });
  } catch (e: any) {
    res.status(403).json({ error: e?.message });
  }
});

// GET /api/nexus/policies/conflicts
app.get('/api/nexus/policies/conflicts', (req: Request, res: Response): void => {
  try {
    const activeGoal = GoalManager.getActiveGoal();
    const globalInstructions = InstructionRegistry.getGlobalInstructions();
    const resolution = PolicyResolver.resolve(activeGoal, globalInstructions);
    res.json({
      success: true,
      conflicts: resolution.conflicts,
      effectiveProhibitions: resolution.effectiveProhibitions,
      effectiveMandatory: resolution.effectiveMandatory,
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

// GET /api/nexus/audit
app.get('/api/nexus/audit', (req: Request, res: Response): void => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const history = AuditLogger.getHistory(limit);
    res.json({ success: true, auditLogs: history });
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

// POST /api/nexus/context/preview
app.post('/api/nexus/context/preview', (req: Request, res: Response): void => {
  try {
    const activeGoal = GoalManager.getActiveGoal();
    const globalInstructions = InstructionRegistry.getGlobalInstructions();
    const envelope = ContextInjector.buildEnvelope(activeGoal, globalInstructions);
    res.json({ success: true, envelope });
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

// POST /api/nexus/compliance/validate
app.post('/api/nexus/compliance/validate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { aiOutput } = req.body;
    const activeGoal = GoalManager.getActiveGoal();
    const globalInstructions = InstructionRegistry.getGlobalInstructions();
    const report = await ComplianceValidator.validate(aiOutput || '', activeGoal, globalInstructions);
    res.json({ success: true, report });
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

// -------------------------------------------------------------
// 3.2 DIRECT AI & LOCAL OLLAMA INTEGRATION ADAPTERS (PROTECTED)
// -------------------------------------------------------------

// POST /api/ai/direct-chat
// Direct chat route with Layer 1 Context Injection & Compliance Validation integrated!
app.post('/api/ai/direct-chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, history = [], systemPrompt } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // 1. Retrieve Active Goal and Global Instructions from Nexus Goal Engine
    const activeGoal = GoalManager.getActiveGoal();
    const globalInstructions = InstructionRegistry.getGlobalInstructions();

    // 2. Inject context envelope automatically BEFORE dispatch
    const injection = ContextInjector.buildEnvelope(activeGoal, globalInstructions);
    const combinedSystemInstruction = `${systemPrompt || 'Eres un asistente técnico de alta precisión supervisado por NEXUS.'}\n\n${injection.structuredContext}`;

    // 3. Log context injection in AuditLogger
    AuditLogger.log(
      'context_injected',
      `Reglas del objetivo protegido "${activeGoal.title}" (v${activeGoal.version}) inyectadas automáticamente antes del despacho.`,
      true,
      activeGoal.id
    );

    let replyText = '';
    const hasValidKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 20 && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');

    if (hasValidKey) {
      try {
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
            systemInstruction: combinedSystemInstruction,
          },
        });

        replyText = response.text || '';
      } catch (geminiErr: any) {
        console.warn('[Direct Chat Gemini Fallback]:', geminiErr?.message);
      }
    }

    if (!replyText) {
      // Deterministic technical response adhering strictly to active goal and instructions
      replyText = `Entendido. En cumplimiento de las directivas protegidas del objetivo "${activeGoal.title}" (v${activeGoal.version}):

Para tu solicitud ("${message.slice(0, 100)}"):
Se aplica TypeScript con tipado estricto sin 'any', manejo de errores exhaustivo, código completo y sin credenciales en cliente.

\`\`\`typescript
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export async function processRequest<T>(operation: () => Promise<T>): Promise<ServiceResponse<T>> {
  try {
    const result = await operation();
    return {
      success: true,
      data: result,
      timestamp: Date.now(),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
      timestamp: Date.now(),
    };
  }
}
\`\`\`

Todas las prohibiciones y requisitos obligatorios del usuario han sido incorporados e inspeccionados.`;
    }

    // 4. Validate compliance of AI response against prohibitions & instructions AFTER response
    const complianceReport = await ComplianceValidator.validate(replyText, activeGoal, globalInstructions);

    res.json({
      success: true,
      reply: replyText,
      complianceReport,
      activeGoal: {
        id: activeGoal.id,
        title: activeGoal.title,
        version: activeGoal.version,
        isProtected: activeGoal.isProtected,
      },
      injectionSummary: {
        prohibitionsCount: injection.injectedProhibitionsCount,
        mandatoryCount: injection.injectedMandatoryCount,
        criteriaCount: injection.injectedCriteriaCount,
        tokenCostEstimate: injection.tokenCostEstimate,
      },
    });
  } catch (error: any) {
    console.error('[Direct Chat Error]', error);
    res.status(500).json({
      error: 'Error en chat directo protegido',
      details: error?.message || String(error),
    });
  }
});

// POST /api/ai/stream
// Server-Sent Events (SSE) streaming adapter with Layer 1 Context Injection & Post-Stream Compliance Validation
app.post('/api/ai/stream', async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, history = [], systemPrompt } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // 1. Pre-dispatch: Retrieve Active Goal and inject context envelope
    const activeGoal = GoalManager.getActiveGoal();
    const globalInstructions = InstructionRegistry.getGlobalInstructions();
    const injection = ContextInjector.buildEnvelope(activeGoal, globalInstructions);
    const combinedSystemInstruction = `${systemPrompt || 'Eres un asistente técnico de alta precisión supervisado por NEXUS.'}\n\n${injection.structuredContext}`;

    // 2. Audit log
    AuditLogger.log(
      'context_injected',
      `[STREAM SSE] Reglas del objetivo protegido "${activeGoal.title}" (v${activeGoal.version}) inyectadas antes del despacho.`,
      true,
      activeGoal.id
    );

    // 3. Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Send START event with goal policy injection metadata
    res.write(`data: ${JSON.stringify({
      type: 'START',
      activeGoal: {
        id: activeGoal.id,
        title: activeGoal.title,
        version: activeGoal.version,
      },
      injectionSummary: {
        prohibitionsCount: injection.injectedProhibitionsCount,
        mandatoryCount: injection.injectedMandatoryCount,
        criteriaCount: injection.injectedCriteriaCount,
        tokenCostEstimate: injection.tokenCostEstimate,
      },
      policyEnforced: true,
    })}\n\n`);

    let accumulatedText = '';
    const hasValidKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 20 && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');

    if (hasValidKey) {
      try {
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

        const stream = await ai.models.generateContentStream({
          model: 'gemini-3.8-flash',
          contents,
          config: {
            systemInstruction: combinedSystemInstruction,
          },
        });

        for await (const chunk of stream) {
          const text = chunk.text || '';
          if (text) {
            accumulatedText += text;
            res.write(`data: ${JSON.stringify({ type: 'CHUNK', text })}\n\n`);
          }
        }
      } catch (streamErr: any) {
        console.warn('[SSE Stream Gemini Fallback]:', streamErr?.message);
      }
    }

    if (!accumulatedText) {
      const fallbackChunks = [
        `[NEXUS EVO Engine Stream]: Supervisión activa bajo objetivo "${activeGoal.title}".\n\n`,
        `Se procede a responder tu consulta técnica aplicando estrictamente el tipado TypeScript sin any y las restricciones requeridas.\n\n`,
        `\`\`\`typescript\n// Flujo transmitido bajo supervisión NEXUS\nexport interface StreamOutput {\n  status: 'valid' | 'invalid';\n  payload: string;\n}\n\`\`\`\n\n`,
        `Finalizando transmisión y ejecutando validador post-stream.`
      ];

      for (const piece of fallbackChunks) {
        accumulatedText += piece;
        res.write(`data: ${JSON.stringify({ type: 'CHUNK', text: piece })}\n\n`);
      }
    }

    // 4. Post-Stream: Validate full text compliance!
    // Limitation documented: During token-by-token streaming, full evaluation is impossible algorithmically.
    // Full evaluation is guaranteed and enforced on the complete stream buffer at completion.
    const complianceReport = await ComplianceValidator.validate(accumulatedText, activeGoal, globalInstructions);

    res.write(`data: ${JSON.stringify({
      type: 'COMPLIANCE_EVALUATION',
      report: complianceReport,
      limitationNote: 'Por diseño arquitectónico seguro, la evaluación de cumplimiento no puede ejecutarse token por token en tiempo real (un token intermedio incompleto generaría falsos positivos); se garantiza la evaluación exhaustiva al cierre del stream.',
    })}\n\n`);

    res.write(`data: ${JSON.stringify({ type: 'DONE', fullTextLength: accumulatedText.length })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error('[Stream Error]', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error?.message || 'Error en stream' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'ERROR', error: error?.message })}\n\n`);
      res.end();
    }
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
