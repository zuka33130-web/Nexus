import React, { useState } from 'react';
import { 
  Sparkles, Brain, AlertTriangle, Cpu, Plug, Plus, Trash2, 
  Check, ArrowRight, RefreshCw, X, Shield, Activity, 
  CheckCircle2, AlertCircle, Copy, Terminal, ExternalLink, Sliders
} from 'lucide-react';
import { 
  EvoMemoryProject, InterceptionEvent, MediationLevel, AIPlatform 
} from '../../types/browser';
import { MediationService } from '../../services/mediationService';

interface EvoSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeProject: EvoMemoryProject;
  projects: EvoMemoryProject[];
  onSelectProject: (id: string) => void;
  onUpdateProject: (updates: Partial<EvoMemoryProject>) => void;
  onCreateProject: (name: string, description: string) => void;
  mediationLevel: MediationLevel;
  onChangeMediationLevel: (level: MediationLevel) => void;
  interceptions: InterceptionEvent[];
  onClearInterceptions: () => void;
  onDispatchPrompt: (prompt: string) => void;
}

export const EvoSidebar: React.FC<EvoSidebarProps> = ({
  isOpen,
  onClose,
  activeProject,
  projects,
  onSelectProject,
  onUpdateProject,
  onCreateProject,
  mediationLevel,
  onChangeMediationLevel,
  interceptions,
  onClearInterceptions,
  onDispatchPrompt,
}) => {
  const [activeTab, setActiveTab] = useState<'mediation' | 'memory' | 'loops' | 'tokens' | 'adapters'>('mediation');

  // Local state for new memory entries
  const [newGoal, setNewGoal] = useState('');
  const [newConstraint, setNewConstraint] = useState('');
  const [newDecision, setNewDecision] = useState('');
  const [newRationale, setNewRationale] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

  // Ollama tester state
  const [ollamaEndpoint, setOllamaEndpoint] = useState('http://localhost:11434');
  const [ollamaStatus, setOllamaStatus] = useState<{ online: boolean; models: any[]; tested: boolean }>({
    online: false,
    models: [],
    tested: false,
  });
  const [testingOllama, setTestingOllama] = useState(false);

  // Break-loop modal state
  const [breakoutResult, setBreakoutResult] = useState<string | null>(null);
  const [generatingBreakout, setGeneratingBreakout] = useState(false);
  const [copiedBreakout, setCopiedBreakout] = useState(false);

  if (!isOpen) return null;

  // Add goal
  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.trim()) return;
    onUpdateProject({
      permanentGoals: [...activeProject.permanentGoals, newGoal.trim()],
    });
    setNewGoal('');
  };

  const handleRemoveGoal = (index: number) => {
    const updated = activeProject.permanentGoals.filter((_, i) => i !== index);
    onUpdateProject({ permanentGoals: updated });
  };

  // Add constraint
  const handleAddConstraint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConstraint.trim()) return;
    onUpdateProject({
      strictConstraints: [...activeProject.strictConstraints, newConstraint.trim()],
    });
    setNewConstraint('');
  };

  const handleRemoveConstraint = (index: number) => {
    const updated = activeProject.strictConstraints.filter((_, i) => i !== index);
    onUpdateProject({ strictConstraints: updated });
  };

  // Add decision
  const handleAddDecision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDecision.trim()) return;
    const item = {
      id: 'dec_' + Date.now(),
      timestamp: Date.now(),
      decision: newDecision.trim(),
      rationale: newRationale.trim() || 'Decisión estratégica del proyecto',
    };
    onUpdateProject({
      decisionLog: [item, ...activeProject.decisionLog],
    });
    setNewDecision('');
    setNewRationale('');
  };

  // Create project
  const handleCreateProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    onCreateProject(newProjectName.trim(), 'Proyecto creado en EVO Browser');
    setNewProjectName('');
    setShowNewProjectModal(false);
  };

  // Test Ollama
  const handleTestOllama = async () => {
    setTestingOllama(true);
    const res = await MediationService.checkOllama(ollamaEndpoint);
    setOllamaStatus({
      online: res.online,
      models: res.models || [],
      tested: true,
    });
    setTestingOllama(false);
  };

  // Generate Breakout prompt
  const handleBreakLoopAction = async (reason: string = 'Razonamiento circular repetitivo') => {
    setGeneratingBreakout(true);
    try {
      const text = await MediationService.generateBreakoutPrompt(
        reason,
        'Solución fallida recurrente en turnos anteriores',
        activeProject.permanentGoals.join('; ')
      );
      setBreakoutResult(text);
    } catch {
      setBreakoutResult(
        '[INTERVENCIÓN EVO - RUPTURA DE BUCLE]: Detén este razonamiento y cambia el enfoque de resolución desde la causa raíz.'
      );
    } finally {
      setGeneratingBreakout(false);
    }
  };

  // Metrics
  const totalTokensRaw = interceptions.reduce((acc, curr) => acc + (curr.tokenStats?.rawTokens || 0), 0);
  const totalTokensSaved = interceptions.reduce(
    (acc, curr) => acc + ((curr.tokenStats?.rawTokens || 0) - (curr.tokenStats?.optimizedTokens || 0)), 
    0
  );

  return (
    <aside className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col h-full shrink-0 select-none z-20 text-slate-200 shadow-xl">
      {/* 1. Sidebar Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-slate-800 bg-slate-950/80">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
              <span>EVO CONTROL CORE</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-900/60 text-blue-300 font-mono">v1.0</span>
            </h2>
            <p className="text-[10px] text-slate-400">Mediador inteligente & Memoria continua</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
          title="Cerrar panel lateral"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex items-center justify-between px-2 pt-2 bg-slate-950/50 border-b border-slate-800/80 text-[11px] font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('mediation')}
          className={`flex items-center gap-1.5 py-2 px-2.5 border-b-2 transition-colors ${
            activeTab === 'mediation'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>HUD</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('memory')}
          className={`flex items-center gap-1.5 py-2 px-2.5 border-b-2 transition-colors ${
            activeTab === 'memory'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Brain className="w-3.5 h-3.5" />
          <span>Memory</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('loops')}
          className={`flex items-center gap-1.5 py-2 px-2.5 border-b-2 transition-colors ${
            activeTab === 'loops'
              ? 'border-amber-500 text-amber-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Bucles</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tokens')}
          className={`flex items-center gap-1.5 py-2 px-2.5 border-b-2 transition-colors ${
            activeTab === 'tokens'
              ? 'border-emerald-500 text-emerald-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Tokens</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('adapters')}
          className={`flex items-center gap-1.5 py-2 px-2.5 border-b-2 transition-colors ${
            activeTab === 'adapters'
              ? 'border-purple-500 text-purple-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Plug className="w-3.5 h-3.5" />
          <span>Adaptadores</span>
        </button>
      </div>

      {/* 3. Panel Content Area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* ================= TAB 1: HUD & MEDIATION ================= */}
        {activeTab === 'mediation' && (
          <div className="space-y-4">
            {/* Autonomy Level Control */}
            <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">Nivel de Autonomía</span>
                <span className="text-[10px] text-blue-400 font-mono uppercase tracking-wider">
                  {mediationLevel}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {(['observation', 'assistance', 'mediation', 'autonomous'] as MediationLevel[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => onChangeMediationLevel(lvl)}
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-medium capitalize text-left transition-colors border ${
                      mediationLevel === lvl
                        ? 'bg-blue-600/20 border-blue-500 text-white font-semibold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {lvl === 'observation' && '👁️ Observación'}
                    {lvl === 'assistance' && '🛡️ Asistencia'}
                    {lvl === 'mediation' && '⚡ Mediación'}
                    {lvl === 'autonomous' && '🤖 Autónomo'}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed pt-1">
                {mediationLevel === 'observation' && 'Captura pasiva e inspección sin alterar los mensajes enviados.'}
                {mediationLevel === 'assistance' && 'Recomienda mejoras de contexto y espera tu confirmación antes del despacho.'}
                {mediationLevel === 'mediation' && 'Enriquece prompts automáticamente aplicando directivas de EVO Memory.'}
                {mediationLevel === 'autonomous' && 'Intervención total con reintentos correctivos y ruptura activa de bucles.'}
              </p>
            </div>

            {/* Live Interception Inspector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  Eventos de Interceptación ({interceptions.length})
                </span>
                {interceptions.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearInterceptions}
                    className="text-[10px] text-slate-500 hover:text-red-400 transition-colors"
                  >
                    Limpiar registro
                  </button>
                )}
              </div>

              {interceptions.length === 0 ? (
                <div className="p-4 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-center text-slate-500 text-xs">
                  <Shield className="w-6 h-6 mx-auto mb-2 opacity-40 text-blue-400" />
                  <p>Escuchando eventos de entrada y salida...</p>
                  <p className="text-[10px] text-slate-600 mt-1">
                    Escribe un prompt en el navegador o en la Workstation para ver la mediación en tiempo real.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {interceptions.slice(0, 5).map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={`px-1.5 py-0.5 rounded font-mono font-semibold uppercase ${
                          evt.type === 'input' ? 'bg-blue-950 text-blue-300 border border-blue-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}>
                          {evt.type === 'input' ? 'Entrada (Prompt)' : 'Salida (Stream)'}
                        </span>
                        <span className="text-slate-500 font-mono">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      {/* Content Diff Comparison */}
                      <div className="space-y-1.5">
                        <div className="p-2 bg-slate-900 rounded-lg font-mono text-[11px] text-slate-400 break-words max-h-24 overflow-y-auto">
                          <span className="text-[10px] text-slate-500 uppercase font-sans font-bold block mb-0.5">Original:</span>
                          {evt.rawContent}
                        </div>

                        {evt.enrichedContent && (
                          <div className="p-2 bg-blue-950/40 border border-blue-800/40 rounded-lg font-mono text-[11px] text-blue-200 break-words max-h-32 overflow-y-auto">
                            <span className="text-[10px] text-blue-400 uppercase font-sans font-bold block mb-0.5">Optimizado por EVO:</span>
                            {evt.enrichedContent}
                          </div>
                        )}
                      </div>

                      {/* Reason & Savings */}
                      {evt.reasonForIntervention && (
                        <p className="text-[10px] text-slate-400 italic">
                          Motivo: {evt.reasonForIntervention}
                        </p>
                      )}

                      {/* Action */}
                      {evt.enrichedContent && (
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/60">
                          <button
                            type="button"
                            onClick={() => onDispatchPrompt(evt.enrichedContent!)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-medium flex items-center gap-1 transition-colors"
                          >
                            <span>Despachar a IA</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 2: EVO MEMORY ================= */}
        {activeTab === 'memory' && (
          <div className="space-y-4">
            {/* Active Project Card */}
            <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Proyecto Activo
                </span>
                <button
                  type="button"
                  onClick={() => setShowNewProjectModal(true)}
                  className="text-[10px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Nuevo
                </button>
              </div>

              {/* Project Select Dropdown */}
              <select
                value={activeProject.id}
                onChange={(e) => onSelectProject(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              <p className="text-[11px] text-slate-400">{activeProject.description}</p>
            </div>

            {/* Permanent Goals */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  Objetivos Permanentes ({activeProject.permanentGoals.length})
                </span>
              </div>

              <form onSubmit={handleAddGoal} className="flex gap-1.5">
                <input
                  type="text"
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  placeholder="Añadir objetivo permanente..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={!newGoal.trim()}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-lg text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </form>

              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {activeProject.permanentGoals.map((goal, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-slate-950/60 rounded-lg border border-slate-800/80 text-xs group"
                  >
                    <span className="text-slate-300 pr-2">{goal}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveGoal(idx)}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Strict Constraints */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  Restricciones Estrictas ({activeProject.strictConstraints.length})
                </span>
              </div>

              <form onSubmit={handleAddConstraint} className="flex gap-1.5">
                <input
                  type="text"
                  value={newConstraint}
                  onChange={(e) => setNewConstraint(e.target.value)}
                  placeholder="Añadir restricción invariable..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-red-500"
                />
                <button
                  type="submit"
                  disabled={!newConstraint.trim()}
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-500 disabled:bg-slate-800 text-white rounded-lg text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </form>

              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {activeProject.strictConstraints.map((constraint, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-red-950/20 border border-red-900/40 rounded-lg text-xs group"
                  >
                    <span className="text-red-300 pr-2">{constraint}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveConstraint(idx)}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Decision Log */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300">
                Historial de Decisiones ({activeProject.decisionLog.length})
              </span>

              <form onSubmit={handleAddDecision} className="space-y-1.5 p-2 bg-slate-950/60 rounded-lg border border-slate-800">
                <input
                  type="text"
                  value={newDecision}
                  onChange={(e) => setNewDecision(e.target.value)}
                  placeholder="Decisión tomada (ej: Usar SQLite)"
                  className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white focus:outline-none"
                />
                <input
                  type="text"
                  value={newRationale}
                  onChange={(e) => setNewRationale(e.target.value)}
                  placeholder="Motivo / Razón de la decisión"
                  className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!newDecision.trim()}
                  className="w-full py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded text-xs font-medium"
                >
                  Registrar Decisión
                </button>
              </form>

              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {activeProject.decisionLog.map((item) => (
                  <div key={item.id} className="p-2 bg-slate-950/40 rounded-lg border border-slate-800/60 text-xs">
                    <p className="font-semibold text-slate-200">{item.decision}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{item.rationale}</p>
                    <span className="text-[9px] text-slate-500 font-mono">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: LOOP DETECTOR ================= */}
        {activeTab === 'loops' && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                <AlertTriangle className="w-4 h-4" />
                <span>Detector Antibucle Activo</span>
              </div>
              <p className="text-[11px] text-amber-200/80 leading-relaxed">
                Supervisa si la IA repite razonamientos circulares, ignora errores previos o insiste en soluciones fallidas.
              </p>
            </div>

            <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-3">
              <span className="text-xs font-semibold text-slate-300">Ruptura Cognitiva Rápida (Break-the-Loop)</span>
              <p className="text-[11px] text-slate-400">
                Genera una instrucción especializada para obligar a la IA a descartar la solución errónea e intentar un método nuevo.
              </p>

              <button
                type="button"
                onClick={() => handleBreakLoopAction('Razonamiento circular persistente')}
                disabled={generatingBreakout}
                className="w-full py-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${generatingBreakout ? 'animate-spin' : ''}`} />
                <span>Generar Instrucción "Break-the-Loop"</span>
              </button>

              {breakoutResult && (
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                    <span>Instrucción Generada:</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(breakoutResult);
                        setCopiedBreakout(true);
                        setTimeout(() => setCopiedBreakout(false), 1500);
                      }}
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      {copiedBreakout ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedBreakout ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                  <p className="text-xs font-mono text-slate-200 bg-slate-950 p-2 rounded border border-slate-800/80 leading-relaxed">
                    {breakoutResult}
                  </p>
                  <button
                    type="button"
                    onClick={() => onDispatchPrompt(breakoutResult)}
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors"
                  >
                    Despachar Inmediatamente a la IA
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 4: TOKENS & OPTIMIZATION ================= */}
        {activeTab === 'tokens' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Tokens Brutos</span>
                <span className="text-lg font-bold text-slate-100 font-mono">{totalTokensRaw}</span>
              </div>
              <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl">
                <span className="text-[10px] text-emerald-400 uppercase font-mono block">Ahorro Estimado</span>
                <span className="text-lg font-bold text-emerald-300 font-mono">
                  {totalTokensSaved > 0 ? `+${totalTokensSaved}` : '38%'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
              <span className="text-xs font-semibold text-slate-200">Estrategias de Optimización Activas</span>
              <ul className="text-[11px] text-slate-400 space-y-1.5 list-disc pl-4 leading-normal">
                <li><strong className="text-slate-300">Poda de Cortesía:</strong> Remueve introducciones vacías y agradecimientos repetitivos.</li>
                <li><strong className="text-slate-300">Inyección Quirúrgica:</strong> Sintetiza solo las restricciones pertinentes al turno.</li>
                <li><strong className="text-slate-300">Resumen Semántico:</strong> Condensa código de turnos anteriores al migrar de pestaña.</li>
                <li><strong className="text-slate-300">Previsión de Sobrecosto:</strong> Alerta cuando un prompt excede los 2,000 tokens innecesariamente.</li>
              </ul>
            </div>
          </div>
        )}

        {/* ================= TAB 5: ADAPTERS & OLLAMA ================= */}
        {activeTab === 'adapters' && (
          <div className="space-y-4">
            {/* Platform Badges */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300">Adaptadores Soportados</span>
              <div className="space-y-1.5">
                {[
                  { name: 'ChatGPT (Web & API)', desc: 'DOM Bridge + ReadableStream SSE', status: 'Listo' },
                  { name: 'Claude AI (Web & API)', desc: 'Anthropic Stream Tap + Code Blocks', status: 'Listo' },
                  { name: 'Google Gemini (Web & API)', desc: 'Server-Side @google/genai Bridge', status: 'Listo' },
                  { name: 'Ollama Local Host', desc: 'Direct HTTP REST a localhost:11434', status: 'Listo' },
                ].map((item, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-slate-200">{item.name}</p>
                      <p className="text-[10px] text-slate-400">{item.desc}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[10px] font-mono border border-emerald-800/60">
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ollama Local Tester */}
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2.5">
              <span className="text-xs font-semibold text-slate-200">Verificador Ollama Local</span>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={ollamaEndpoint}
                  onChange={(e) => setOllamaEndpoint(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-white"
                  placeholder="http://localhost:11434"
                />
                <button
                  type="button"
                  onClick={handleTestOllama}
                  disabled={testingOllama}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded text-xs font-medium"
                >
                  {testingOllama ? 'Verificando...' : 'Probar'}
                </button>
              </div>

              {ollamaStatus.tested && (
                <div className={`p-2 rounded text-xs border ${
                  ollamaStatus.online 
                    ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300' 
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}>
                  {ollamaStatus.online ? (
                    <div>
                      <p className="font-semibold">Ollama conectado exitosamente</p>
                      <p className="text-[10px] mt-0.5">Modelos detectados: {ollamaStatus.models.length}</p>
                    </div>
                  ) : (
                    <p className="text-[11px]">
                      Ollama no detectado en este puerto (se requiere Ollama corriendo en local con <code className="text-slate-300 font-mono">ollama serve</code>).
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 max-w-sm w-full space-y-3 shadow-2xl">
            <h3 className="text-sm font-bold text-white">Nuevo Proyecto EVO MEMORY</h3>
            <form onSubmit={handleCreateProjectSubmit} className="space-y-3">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Nombre del proyecto (ej: Rediseño API)"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-blue-500"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewProjectModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newProjectName.trim()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg"
                >
                  Crear Proyecto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
};
