import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, Send, Sparkles, AlertTriangle, RotateCw, CheckCircle2, 
  Terminal, Shield, ArrowUpRight, Copy, Check, ChevronDown, 
  Code, RefreshCcw, Layers
} from 'lucide-react';
import { AIPlatform, BrowserTab, EvoMemoryProject, InterceptionEvent, LoopWarning, MediationLevel } from '../../types/browser';

interface BrowserViewportProps {
  activeTab: BrowserTab;
  viewMode: 'proxy' | 'workstation';
  activeProject: EvoMemoryProject;
  mediationLevel: MediationLevel;
  onInterceptInput: (prompt: string, platform: AIPlatform, source: 'proxy' | 'workstation') => void;
  approvedWorkstationPrompt: { prompt: string; id: number } | null;
  onStreamChunk: (chunk: string, platform: AIPlatform) => void;
  onStreamComplete: (fullText: string, platform: AIPlatform) => void;
  onTriggerBreakLoop: () => void;
}

export const BrowserViewport: React.FC<BrowserViewportProps> = ({
  activeTab,
  viewMode,
  activeProject,
  mediationLevel,
  onInterceptInput,
  approvedWorkstationPrompt,
  onStreamChunk,
  onStreamComplete,
  onTriggerBreakLoop,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeError, setIframeError] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);

  // Workstation state
  const [workstationPlatform, setWorkstationPlatform] = useState<AIPlatform>(
    activeTab.aiPlatform || 'chatgpt'
  );
  const [workstationInput, setWorkstationInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    platform: AIPlatform;
    wasMediated?: boolean;
    tokenCount?: number;
    loopWarning?: LoopWarning;
  }>>([
    {
      id: 'welcome',
      role: 'system',
      content: `EVO Workstation inicializado con el proyecto "${activeProject.name}". Nivel de mediación: ${mediationLevel.toUpperCase()}. Las directivas permanentes y restricciones están activas y serán aplicadas en cada mensaje.`,
      timestamp: Date.now(),
      platform: 'generic',
    }
  ]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat in workstation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isGenerating]);

  // Sync platform when active tab url changes
  useEffect(() => {
    if (activeTab.aiPlatform) {
      setWorkstationPlatform(activeTab.aiPlatform);
    }
  }, [activeTab.aiPlatform]);

  // Handle iframe load
  const handleIframeLoad = () => {
    setIframeLoading(false);
    setIframeError(false);
  };

  const handleIframeError = () => {
    setIframeLoading(false);
    setIframeError(true);
  };

  const lastExecutedApprovedId = useRef<number | null>(null);

  // Core execution function that actually dispatches to the AI model
  const executeWorkstationPrompt = async (finalPrompt: string, wasMediated: boolean = false) => {
    const userMsgId = 'msg_' + Date.now();
    const updatedMessages = [
      ...chatMessages,
      {
        id: userMsgId,
        role: 'user' as const,
        content: finalPrompt,
        timestamp: Date.now(),
        platform: workstationPlatform,
        wasMediated,
        tokenCount: Math.ceil(finalPrompt.length / 4),
      }
    ];

    setChatMessages(updatedMessages);
    setIsGenerating(true);

    try {
      const resp = await fetch('/api/ai/direct-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: finalPrompt,
          history: updatedMessages
            .filter(m => m.role !== 'system')
            .map(m => ({ role: m.role, content: m.content })),
          systemPrompt: `Eres una IA operando bajo la supervisión de EVO BROWSER para el proyecto "${activeProject.name}".
Stack: ${activeProject.techStack.join(', ')}.
Objetivos permanentes: ${activeProject.permanentGoals.join('; ')}.
Restricciones estrictas: ${activeProject.strictConstraints.join('; ')}.
Responde con máxima precisión y profesionalismo.`,
        }),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const replyText = data.reply || 'Sin respuesta';

      onStreamChunk(replyText, workstationPlatform);
      onStreamComplete(replyText, workstationPlatform);

      const isRepeated = chatMessages.some(
        m => m.role === 'assistant' && m.content.slice(0, 100) === replyText.slice(0, 100)
      );

      const assistantMsg = {
        id: 'msg_' + (Date.now() + 1),
        role: 'assistant' as const,
        content: replyText,
        timestamp: Date.now(),
        platform: workstationPlatform,
        tokenCount: Math.ceil(replyText.length / 4),
        loopWarning: isRepeated ? {
          isLoop: true,
          confidence: 0.95,
          reason: 'Respuesta repetida detectada respecto al turno previo.',
          repetitionCount: 2,
          suggestedBreakout: 'Intervenir con directiva Break-the-Loop',
        } : undefined,
      };

      setChatMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setChatMessages(prev => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          role: 'assistant' as const,
          content: `[Error de conexión con el proveedor]: ${err?.message || 'Error de red'}. Verifique la conexión o el endpoint de Ollama.`,
          timestamp: Date.now(),
          platform: workstationPlatform,
        }
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  // Listen for externally approved prompts (from Asistencia mode curtain or auto-mediation)
  useEffect(() => {
    if (approvedWorkstationPrompt && approvedWorkstationPrompt.id !== lastExecutedApprovedId.current) {
      lastExecutedApprovedId.current = approvedWorkstationPrompt.id;
      executeWorkstationPrompt(approvedWorkstationPrompt.prompt, true);
    }
  }, [approvedWorkstationPrompt]);

  // Workstation submission handler
  const handleWorkstationSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const prompt = workstationInput.trim();
    if (!prompt || isGenerating) return;

    // Clear input field immediately
    setWorkstationInput('');

    // If in assistance mode: STOP original dispatch!
    // Trigger mediation hook and wait for user's explicit approval in the curtain
    if (mediationLevel === 'assistance') {
      console.log('[EVO Workstation] Halting original submission for user approval in Assistance mode.');
      onInterceptInput(prompt, workstationPlatform, 'workstation');
      return;
    }

    // In mediation or autonomous mode: intercept and allow App.tsx to analyze & auto-dispatch
    if (mediationLevel === 'mediation' || mediationLevel === 'autonomous') {
      console.log('[EVO Workstation] Halting original submission for auto-mediation.');
      onInterceptInput(prompt, workstationPlatform, 'workstation');
      return;
    }

    // In observation mode: intercept for logging and execute unmediated
    onInterceptInput(prompt, workstationPlatform, 'workstation');
    executeWorkstationPrompt(prompt, false);
  };

  const handleSimulateLoop = () => {
    const loopMessage = `Para resolver este problema, te recomiendo reinstalar el paquete 'legacy-core' y reiniciar el servicio con 'service restart'.`;
    const userPrompt = `Sigue fallando con el mismo error de antes. ¿Qué hago?`;

    // Intercept input
    onInterceptInput(userPrompt, workstationPlatform, 'workstation');

    setChatMessages(prev => [
      ...prev,
      {
        id: 'sim_u_' + Date.now(),
        role: 'user',
        content: userPrompt,
        timestamp: Date.now(),
        platform: workstationPlatform,
      },
      {
        id: 'sim_a_' + (Date.now() + 1),
        role: 'assistant',
        content: loopMessage,
        timestamp: Date.now() + 100,
        platform: workstationPlatform,
        loopWarning: {
          isLoop: true,
          confidence: 0.98,
          reason: 'La IA está recomendando exactamente la misma solución fallida por 3ra vez consecutiva sin progresar.',
          repetitionCount: 3,
          suggestedBreakout: 'Requerir cambio de enfoque arquitectónico y depurar stack trace sin reinstalar.',
          previousFailedSolution: 'Reinstalar legacy-core',
        }
      }
    ]);

    onStreamComplete(loopMessage, workstationPlatform);
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const proxyUrl = `/api/proxy/browse?url=${encodeURIComponent(activeTab.url)}`;

  return (
    <div className="flex-1 flex flex-col relative bg-slate-950 overflow-hidden h-full">
      {/* Viewport Header Bar: Mode & Diagnostics */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/60 border-b border-slate-800/60 text-xs shrink-0 select-none">
        <div className="flex items-center gap-2">
          {viewMode === 'proxy' ? (
            <div className="flex items-center gap-1.5 text-slate-300">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-medium">Proxy Stream Activo:</span>
              <span className="font-mono text-slate-400 truncate max-w-[280px]">
                {activeTab.url}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-300">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-medium">EVO Workstation:</span>
              {/* Platform Selector */}
              <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800">
                {(['chatgpt', 'claude', 'gemini', 'ollama'] as AIPlatform[]).map(plat => (
                  <button
                    key={plat}
                    type="button"
                    onClick={() => setWorkstationPlatform(plat)}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded capitalize transition-colors ${
                      workstationPlatform === plat
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {plat}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Status */}
        <div className="flex items-center gap-3 text-slate-400 text-[11px]">
          {viewMode === 'workstation' && (
            <button
              type="button"
              onClick={handleSimulateLoop}
              className="flex items-center gap-1 px-2 py-0.5 bg-amber-950/40 border border-amber-800/40 text-amber-300 hover:bg-amber-900/40 rounded transition-colors"
              title="Dispara una simulación de bucle repetitivo para probar el detector"
            >
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>Simular Bucle</span>
            </button>
          )}

          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="font-mono">Bridge Activo</span>
          </div>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'proxy' ? (
        /* PROXY VIEW: Real web iframe with CSP bypass */
        <div className="flex-1 relative w-full h-full bg-slate-950">
          {iframeLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xs text-slate-300">
              <RotateCw className="w-6 h-6 animate-spin text-blue-500 mb-2" />
              <p className="text-xs font-medium">Cargando a través de EVO Reverse Proxy...</p>
              <p className="text-[11px] text-slate-500 mt-1 font-mono">{activeTab.url}</p>
            </div>
          )}

          {iframeError ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-950 text-slate-200">
              <div className="w-12 h-12 rounded-full bg-red-950/60 border border-red-800/60 flex items-center justify-center text-red-400 mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">
                Conexión bloqueada por el host remoto
              </h3>
              <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
                El sitio <strong>{activeTab.url}</strong> bloquea conexiones de proxys en iframes debido a políticas estrictas de firewall o Cloudflare.
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => window.open(activeTab.url, '_blank')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Abrir en Ventana Externa
                </button>
                <button
                  type="button"
                  onClick={() => setIframeLoading(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Reintentar Proxy
                </button>
              </div>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={proxyUrl}
              title={activeTab.title}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              className="w-full h-full border-none bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />
          )}
        </div>
      ) : (
        /* WORKSTATION VIEW: Full-Fidelity AI Mediation Playground */
        <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${
                  msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-medium ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : msg.role === 'system'
                      ? 'bg-slate-800 text-slate-300'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {msg.role === 'user' ? 'Tú' : msg.role === 'system' ? <Layers className="w-3.5 h-3.5" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div className={`flex flex-col gap-1 max-w-[85%]`}>
                  {/* Sender & Metainfo */}
                  <div className={`flex items-center gap-2 text-[10px] text-slate-400 px-1 ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}>
                    <span className="capitalize font-medium">{msg.platform}</span>
                    <span>·</span>
                    <span className="font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    {msg.tokenCount && (
                      <>
                        <span>·</span>
                        <span className="font-mono text-slate-500">~{msg.tokenCount} tokens</span>
                      </>
                    )}
                    {msg.wasMediated && (
                      <>
                        <span>·</span>
                        <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5" />
                          Optimizado por EVO
                        </span>
                      </>
                    )}
                  </div>

                  {/* Body */}
                  <div
                    className={`rounded-xl p-3.5 text-xs leading-relaxed border ${
                      msg.role === 'user'
                        ? 'bg-blue-950/50 border-blue-800/60 text-slate-100'
                        : msg.role === 'system'
                        ? 'bg-slate-900/60 border-slate-800 text-slate-300 italic'
                        : 'bg-slate-900 border-slate-800 text-slate-100 shadow-xs'
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-sans">{msg.content}</div>

                    {/* Loop Warning Callout */}
                    {msg.loopWarning?.isLoop && (
                      <div className="mt-3 p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-red-200">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5 font-semibold text-xs text-red-400">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Bucle Circular Detectado por EVO</span>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/60 text-red-300 font-mono">
                            Confianza: {Math.round(msg.loopWarning.confidence * 100)}%
                          </span>
                        </div>
                        <p className="text-[11px] text-red-300/90 leading-normal mb-2">
                          {msg.loopWarning.reason}
                        </p>
                        <button
                          type="button"
                          onClick={onTriggerBreakLoop}
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[11px] font-medium transition-colors flex items-center gap-1"
                        >
                          <RefreshCcw className="w-3 h-3" />
                          Romper Bucle Cognitivo
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Quick Copy */}
                  <div className={`flex items-center gap-1 px-1 ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}>
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg.id, msg.content)}
                      className="p-1 text-slate-500 hover:text-slate-300 rounded transition-colors text-[10px] flex items-center gap-1"
                      title="Copiar texto"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {isGenerating && (
              <div className="flex items-center gap-2 text-xs text-blue-400 animate-pulse pl-10">
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Intervención en progreso y recepción de tokens...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Workstation Prompt Input Box */}
          <div className="p-3 bg-slate-900/80 border-t border-slate-800 shrink-0">
            <form onSubmit={handleWorkstationSubmit} className="relative flex flex-col gap-2">
              <div className="relative flex items-center">
                <textarea
                  rows={2}
                  value={workstationInput}
                  onChange={(e) => setWorkstationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleWorkstationSubmit();
                    }
                  }}
                  placeholder={`Escribe tu consulta para ${workstationPlatform.toUpperCase()} (EVO interceptará y aplicará ${activeProject.name})...`}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none resize-none pr-24"
                />

                {/* Submit Button */}
                <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1">
                  <button
                    type="submit"
                    disabled={!workstationInput.trim() || isGenerating}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                      workstationInput.trim() && !isGenerating
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-xs'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <span>Enviar</span>
                    <Send className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Input Tips */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                <span>Shift+Enter para nueva línea · Enter para enviar con mediación</span>
                <span className="font-mono">
                  {workstationInput.length} caracteres (~{Math.ceil(workstationInput.length / 4)} tokens)
                </span>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
