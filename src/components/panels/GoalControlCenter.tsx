import React, { useState, useEffect } from 'react';
import { 
  Target, Shield, Lock, Unlock, AlertTriangle, CheckCircle2, 
  Plus, Trash2, Edit3, Eye, History, FileText, Check, X, 
  RotateCw, RefreshCw, Key, ChevronRight, Layers, HelpCircle
} from 'lucide-react';
import { 
  AuditLogEntry, 
  ContextInjectionResult, 
  GlobalInstructions, 
  NexusGoal, 
  PolicyConflict 
} from '../../types/goals';
import { NexusGoalService } from '../../services/nexusGoalService';

interface GoalControlCenterProps {
  onGoalUpdated?: (activeGoal: NexusGoal) => void;
}

export const GoalControlCenter: React.FC<GoalControlCenterProps> = ({ onGoalUpdated }) => {
  const [subTab, setSubTab] = useState<'active' | 'library' | 'global' | 'conflicts' | 'audit'>('active');
  const [goals, setGoals] = useState<NexusGoal[]>([]);
  const [activeGoal, setActiveGoal] = useState<NexusGoal | null>(null);
  const [globalInstructions, setGlobalInstructions] = useState<GlobalInstructions | null>(null);
  const [conflicts, setConflicts] = useState<PolicyConflict[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Authorization Modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<((auth: { challengeToken: string; confirmationCode: string }) => Promise<void>) | null>(null);
  const [authDescription, setAuthDescription] = useState('');
  const [serverChallenge, setServerChallenge] = useState<{ challengeToken: string; confirmationCode: string; expiresAt: number; prompt: string } | null>(null);
  const [userTypedCode, setUserTypedCode] = useState('');

  // New Goal Modal state
  const [showNewGoalModal, setShowNewGoalModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newOutcome, setNewOutcome] = useState('');
  const [newProhibitions, setNewProhibitions] = useState('');
  const [newMandatory, setNewMandatory] = useState('');
  const [newCriteria, setNewCriteria] = useState('');
  const [newIsProtected, setNewIsProtected] = useState(true);

  // Context Preview Modal
  const [previewEnvelope, setPreviewEnvelope] = useState<ContextInjectionResult | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Inline additions to active goal
  const [inputProhibition, setInputProhibition] = useState('');
  const [inputMandatory, setInputMandatory] = useState('');
  const [inputCriterion, setInputCriterion] = useState('');

  const loadAllData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [fetchedGoals, fetchedActive, fetchedGlobal, fetchedConflicts, fetchedAudit] = await Promise.all([
        NexusGoalService.getGoals(),
        NexusGoalService.getActiveGoal(),
        NexusGoalService.getGlobalInstructions(),
        NexusGoalService.getConflicts(),
        NexusGoalService.getAuditLogs(50),
      ]);

      setGoals(fetchedGoals);
      setActiveGoal(fetchedActive);
      setGlobalInstructions(fetchedGlobal);
      setConflicts(fetchedConflicts.conflicts || []);
      setAuditLogs(fetchedAudit);
      if (fetchedActive && onGoalUpdated) {
        onGoalUpdated(fetchedActive);
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Error cargando datos del motor de objetivos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const triggerNotification = (msg: string, isError: boolean = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 4000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  // Safe action with server-verified authorization challenge
  const requestProtectedAction = async (
    action: 'update' | 'delete' | 'global_update' | 'unprotect',
    actionDesc: string, 
    actionFn: (auth?: { challengeToken: string; confirmationCode: string }) => Promise<void>, 
    isProtected: boolean,
    goalId?: string
  ) => {
    if (!isProtected) {
      actionFn().catch((e: any) => triggerNotification(e?.message, true));
      return;
    }

    try {
      const challenge = await NexusGoalService.requestChallenge(action, goalId, actionDesc);
      setServerChallenge(challenge);
      setAuthDescription(actionDesc);
      setUserTypedCode('');
      setPendingAction(() => async (auth: { challengeToken: string; confirmationCode: string }) => {
        await actionFn(auth);
      });
      setShowAuthModal(true);
    } catch (err: any) {
      triggerNotification(`Error al solicitar token de autorización al servidor: ${err?.message}`, true);
    }
  };

  const handleConfirmAuthorization = async () => {
    if (!serverChallenge || !pendingAction) return;
    if (userTypedCode.trim().toUpperCase() !== serverChallenge.confirmationCode.trim().toUpperCase()) {
      triggerNotification('Código de confirmación incorrecto.', true);
      return;
    }
    try {
      await pendingAction({
        challengeToken: serverChallenge.challengeToken,
        confirmationCode: userTypedCode.trim().toUpperCase(),
      });
      setShowAuthModal(false);
      setPendingAction(null);
      setServerChallenge(null);
      await loadAllData();
      triggerNotification('Modificación protegida verificada por el servidor y ejecutada.');
    } catch (e: any) {
      triggerNotification(e?.message || 'Error al ejecutar acción autorizada', true);
    }
  };

  // Add rule to active goal
  const handleAddProhibition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGoal || !inputProhibition.trim()) return;
    const item = inputProhibition.trim();

    requestProtectedAction(
      'update',
      `Añadir prohibición: "${item}" al objetivo protegido "${activeGoal.title}"`,
      async (auth) => {
        await NexusGoalService.updateGoal(
          activeGoal.id,
          { prohibitions: [...activeGoal.prohibitions, item] },
          auth
        );
        setInputProhibition('');
        await loadAllData();
        triggerNotification('Prohibición añadida.');
      },
      activeGoal.isProtected,
      activeGoal.id
    );
  };

  const handleRemoveProhibition = (index: number) => {
    if (!activeGoal) return;
    const item = activeGoal.prohibitions[index];
    const updated = activeGoal.prohibitions.filter((_, i) => i !== index);

    requestProtectedAction(
      'update',
      `Eliminar la prohibición: "${item}" del objetivo protegido "${activeGoal.title}"`,
      async (auth) => {
        await NexusGoalService.updateGoal(activeGoal.id, { prohibitions: updated }, auth);
        await loadAllData();
        triggerNotification('Prohibición eliminada.');
      },
      activeGoal.isProtected,
      activeGoal.id
    );
  };

  const handleAddMandatory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGoal || !inputMandatory.trim()) return;
    const item = inputMandatory.trim();

    requestProtectedAction(
      'update',
      `Añadir instrucción obligatoria: "${item}"`,
      async (auth) => {
        await NexusGoalService.updateGoal(
          activeGoal.id,
          { mandatoryInstructions: [...activeGoal.mandatoryInstructions, item] },
          auth
        );
        setInputMandatory('');
        await loadAllData();
        triggerNotification('Instrucción obligatoria registrada.');
      },
      activeGoal.isProtected,
      activeGoal.id
    );
  };

  const handleRemoveMandatory = (index: number) => {
    if (!activeGoal) return;
    const item = activeGoal.mandatoryInstructions[index];
    const updated = activeGoal.mandatoryInstructions.filter((_, i) => i !== index);

    requestProtectedAction(
      'update',
      `Eliminar instrucción obligatoria: "${item}"`,
      async (auth) => {
        await NexusGoalService.updateGoal(activeGoal.id, { mandatoryInstructions: updated }, auth);
        await loadAllData();
        triggerNotification('Instrucción obligatoria eliminada.');
      },
      activeGoal.isProtected,
      activeGoal.id
    );
  };

  const handleAddCriterion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGoal || !inputCriterion.trim()) return;
    const item = inputCriterion.trim();

    requestProtectedAction(
      'update',
      `Añadir criterio de éxito: "${item}"`,
      async (auth) => {
        await NexusGoalService.updateGoal(
          activeGoal.id,
          { successCriteria: [...activeGoal.successCriteria, item] },
          auth
        );
        setInputCriterion('');
        await loadAllData();
        triggerNotification('Criterio de éxito registrado.');
      },
      activeGoal.isProtected,
      activeGoal.id
    );
  };

  // Activate Goal
  const handleActivateGoal = async (id: string) => {
    try {
      const activated = await NexusGoalService.activateGoal(id);
      await loadAllData();
      triggerNotification(`Objetivo "${activated.title}" activado.`);
    } catch (e: any) {
      triggerNotification(e?.message, true);
    }
  };

  // Toggle protection flag
  const handleToggleProtection = () => {
    if (!activeGoal) return;
    const newProtection = !activeGoal.isProtected;

    requestProtectedAction(
      newProtection ? 'update' : 'unprotect',
      `${newProtection ? 'Activar' : 'Desactivar'} protección inmutable del objetivo "${activeGoal.title}"`,
      async (auth) => {
        await NexusGoalService.updateGoal(activeGoal.id, { isProtected: newProtection }, auth);
        await loadAllData();
        triggerNotification(`Protección ${newProtection ? 'activada' : 'desactivada'}.`);
      },
      activeGoal.isProtected, // require authorization if currently protected!
      activeGoal.id
    );
  };

  // Create Goal
  const handleCreateGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim()) return;

    try {
      const prohibitionsList = newProhibitions
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);
      const mandatoryList = newMandatory
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);
      const criteriaList = newCriteria
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

      const created = await NexusGoalService.createGoal({
        title: newTitle.trim(),
        description: newDesc.trim(),
        expectedOutcome: newOutcome.trim() || 'Cumplimiento estricto',
        prohibitions: prohibitionsList,
        mandatoryInstructions: mandatoryList,
        constraints: ['Estabilidad técnica'],
        successCriteria: criteriaList,
        isProtected: newIsProtected,
        status: 'draft',
        scope: 'project_specific',
      });

      setShowNewGoalModal(false);
      setNewTitle('');
      setNewDesc('');
      setNewOutcome('');
      setNewProhibitions('');
      setNewMandatory('');
      setNewCriteria('');
      await loadAllData();
      triggerNotification(`Objetivo "${created.title}" creado.`);
    } catch (e: any) {
      triggerNotification(e?.message, true);
    }
  };

  // Preview Envelope
  const handlePreviewEnvelope = async () => {
    try {
      const preview = await NexusGoalService.previewContextEnvelope();
      setPreviewEnvelope(preview);
      setShowPreviewModal(true);
    } catch (e: any) {
      triggerNotification(e?.message, true);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 text-slate-200 select-none overflow-hidden">
      {/* 1. Header */}
      <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center text-emerald-400">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
              <span>GOAL CONTROL CENTER</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 font-mono border border-emerald-800/80">
                CAPA 1
              </span>
            </h2>
            <p className="text-[10px] text-slate-400">Protección inmutable de objetivos y directivas</p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadAllData}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
          title="Actualizar datos"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="px-3 py-1.5 bg-red-950/80 border-b border-red-800 text-red-200 text-[11px] flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span className="truncate">{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="px-3 py-1.5 bg-emerald-950/80 border-b border-emerald-800 text-emerald-200 text-[11px] flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">{successMsg}</span>
        </div>
      )}

      {/* 2. Subtabs Navigation */}
      <div className="flex items-center justify-between px-2 pt-2 bg-slate-950/60 border-b border-slate-800/80 text-[11px] font-medium shrink-0">
        <button
          type="button"
          onClick={() => setSubTab('active')}
          className={`flex items-center gap-1 py-2 px-2.5 border-b-2 transition-colors ${
            subTab === 'active'
              ? 'border-emerald-500 text-emerald-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-3 h-3" />
          <span>Activo</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('library')}
          className={`flex items-center gap-1 py-2 px-2.5 border-b-2 transition-colors ${
            subTab === 'library'
              ? 'border-emerald-500 text-emerald-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3 h-3" />
          <span>Objetivos ({goals.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('global')}
          className={`flex items-center gap-1 py-2 px-2.5 border-b-2 transition-colors ${
            subTab === 'global'
              ? 'border-emerald-500 text-emerald-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3 h-3" />
          <span>Globales</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('conflicts')}
          className={`flex items-center gap-1 py-2 px-2.5 border-b-2 transition-colors ${
            subTab === 'conflicts'
              ? 'border-amber-500 text-amber-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertTriangle className="w-3 h-3" />
          <span>Conflictos ({conflicts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('audit')}
          className={`flex items-center gap-1 py-2 px-2.5 border-b-2 transition-colors ${
            subTab === 'audit'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-3 h-3" />
          <span>Auditoría</span>
        </button>
      </div>

      {/* 3. Subtab Content Area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* ================= SUBTAB: ACTIVE GOAL ================= */}
        {subTab === 'active' && activeGoal && (
          <div className="space-y-3.5">
            {/* Active Goal Header Banner */}
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-emerald-400 uppercase font-mono tracking-wider font-semibold flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Objetivo Activo en Memoria
                </span>

                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    v{activeGoal.version}
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleProtection}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                      activeGoal.isProtected
                        ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                        : 'bg-amber-950/60 border-amber-800 text-amber-300'
                    }`}
                    title={activeGoal.isProtected ? 'Reglas protegidas contra modificaciones no autorizadas' : 'Reglas desprotegidas'}
                  >
                    {activeGoal.isProtected ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    <span>{activeGoal.isProtected ? 'PROTEGIDO' : 'DESPROTEGIDO'}</span>
                  </button>
                </div>
              </div>

              <h3 className="text-sm font-bold text-white leading-tight">{activeGoal.title}</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">{activeGoal.description}</p>
              
              <div className="pt-1.5 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Resultado Esperado:</span>
                <p className="text-xs text-emerald-300 font-medium">{activeGoal.expectedOutcome}</p>
              </div>

              {/* Action buttons */}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handlePreviewEnvelope}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium flex items-center gap-1 transition-colors"
                >
                  <Eye className="w-3 h-3 text-blue-400" />
                  <span>Previsualizar Inyección</span>
                </button>
              </div>
            </div>

            {/* Prohibitions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Prohibiciones Específicas ({activeGoal.prohibitions.length})</span>
                </span>
              </div>

              <form onSubmit={handleAddProhibition} className="flex gap-1.5">
                <input
                  type="text"
                  value={inputProhibition}
                  onChange={(e) => setInputProhibition(e.target.value)}
                  placeholder="Prohibir expresamente (ej: No usar mocks)..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-red-500"
                />
                <button
                  type="submit"
                  disabled={!inputProhibition.trim()}
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-500 disabled:bg-slate-800 text-white rounded-lg text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </form>

              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {activeGoal.prohibitions.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-red-950/20 border border-red-900/40 rounded-lg text-xs group"
                  >
                    <span className="text-red-300 pr-2">{p}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveProhibition(idx)}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-1"
                      title="Eliminar prohibición"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Mandatory Instructions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Instrucciones Obligatorias ({activeGoal.mandatoryInstructions.length})</span>
                </span>
              </div>

              <form onSubmit={handleAddMandatory} className="flex gap-1.5">
                <input
                  type="text"
                  value={inputMandatory}
                  onChange={(e) => setInputMandatory(e.target.value)}
                  placeholder="Instrucción ineludible (ej: Código tipado)..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={!inputMandatory.trim()}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-lg text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </form>

              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {activeGoal.mandatoryInstructions.map((m, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-blue-950/20 border border-blue-900/40 rounded-lg text-xs group"
                  >
                    <span className="text-blue-200 pr-2">{m}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMandatory(idx)}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Success Criteria */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />
                  <span>Criterios de Éxito ({activeGoal.successCriteria.length})</span>
                </span>
              </div>

              <form onSubmit={handleAddCriterion} className="flex gap-1.5">
                <input
                  type="text"
                  value={inputCriterion}
                  onChange={(e) => setInputCriterion(e.target.value)}
                  placeholder="Criterio verificable (ej: Tests pasando 100%)..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={!inputCriterion.trim()}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white rounded-lg text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </form>

              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {activeGoal.successCriteria.map((c, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-emerald-950/20 border border-emerald-900/40 rounded-lg text-xs text-emerald-200"
                  >
                    <span>✓ {c}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= SUBTAB: GOALS LIBRARY ================= */}
        {subTab === 'library' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Catálogo de Objetivos Nexus</span>
              <button
                type="button"
                onClick={() => setShowNewGoalModal(true)}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo Objetivo</span>
              </button>
            </div>

            <div className="space-y-2">
              {goals.map((g) => {
                const isActive = g.status === 'active';
                return (
                  <div
                    key={g.id}
                    className={`p-3 rounded-xl border text-xs transition-all ${
                      isActive
                        ? 'bg-slate-950 border-emerald-600/80 shadow-xs ring-1 ring-emerald-500/20'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded uppercase ${
                          isActive ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {g.status}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">v{g.version}</span>
                        {g.isProtected && (
                          <span className="text-[9px] text-emerald-400 flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5" />
                            Protegido
                          </span>
                        )}
                      </div>

                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => handleActivateGoal(g.id)}
                          className="px-2 py-0.5 bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600 hover:text-white rounded text-[10px] font-medium transition-colors"
                        >
                          Activar
                        </button>
                      )}
                    </div>

                    <h4 className="font-bold text-white text-xs">{g.title}</h4>
                    <p className="text-slate-400 text-[11px] mt-1 line-clamp-2">{g.description}</p>
                    
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-2 font-mono">
                      <span>Prohibiciones: {g.prohibitions.length}</span>
                      <span>Obligatorias: {g.mandatoryInstructions.length}</span>
                      <span>Criterios: {g.successCriteria.length}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= SUBTAB: GLOBAL INSTRUCTIONS ================= */}
        {subTab === 'global' && globalInstructions && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5">
              <span className="text-xs font-semibold text-slate-200">Políticas Globales Inviolables</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Estas directivas se incorporan a todas las peticiones a la IA, independientemente del objetivo específico activo. Tienen prioridad ante cualquier contradicción.
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-red-400">Prohibiciones Globales</span>
              <div className="space-y-1.5">
                {globalInstructions.prohibitions.map((p, i) => (
                  <div key={i} className="p-2 bg-red-950/20 border border-red-900/40 rounded-lg text-xs text-red-300">
                    {p}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-blue-400">Instrucciones Obligatorias Globales</span>
              <div className="space-y-1.5">
                {globalInstructions.mandatoryInstructions.map((m, i) => (
                  <div key={i} className="p-2 bg-blue-950/20 border border-blue-900/40 rounded-lg text-xs text-blue-200">
                    {m}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= SUBTAB: CONFLICTS & POLICY RESOLVER ================= */}
        {subTab === 'conflicts' && (
          <div className="space-y-3">
            <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs">
                <AlertTriangle className="w-4 h-4" />
                <span>PolicyResolver: Detección y Resolución de Conflictos</span>
              </div>
              <p className="text-[11px] text-amber-200/80 leading-relaxed">
                Supervisa si existen contradicciones entre directivas del usuario y aplica la jerarquía formal: Prohibiciones &gt; Restricciones Estrictas &gt; Obligatorias.
              </p>
            </div>

            {conflicts.length === 0 ? (
              <div className="p-6 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-center text-slate-500 text-xs">
                <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-emerald-500 opacity-60" />
                <p className="font-semibold text-slate-400">Sin conflictos activos</p>
                <p className="text-[10px] text-slate-600 mt-1">
                  Todas las directivas, prohibiciones e instrucciones son armónicas y cumplen la jerarquía de políticas.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {conflicts.map((c) => (
                  <div key={c.id} className="p-3 bg-slate-950/80 border border-amber-800/60 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 font-mono font-semibold uppercase">
                        {c.type} · {c.severity}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(c.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <p className="font-semibold text-slate-200">{c.description}</p>
                    
                    <div className="p-2 bg-slate-900 rounded font-mono text-[10px] text-slate-400 space-y-1">
                      {c.conflictingRules.map((r, i) => (
                        <p key={i}>• {r}</p>
                      ))}
                    </div>

                    <p className="text-[11px] text-emerald-300 font-medium bg-emerald-950/30 p-2 rounded border border-emerald-800/40">
                      Resolución: {c.resolution}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= SUBTAB: AUDIT LOGS ================= */}
        {subTab === 'audit' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Historial Inmutable de Auditoría</span>
              <span className="text-[10px] text-slate-500 font-mono">{auditLogs.length} eventos</span>
            </div>

            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className={`px-1.5 py-0.2 rounded font-mono font-semibold uppercase ${
                      log.authorized ? 'bg-slate-800 text-slate-300' : 'bg-red-950 text-red-300 border border-red-800'
                    }`}>
                      {log.action}
                    </span>
                    <span className="text-slate-500 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-slate-300 text-[11px]">{log.details}</p>

                  <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono pt-0.5">
                    <span>Autor: {log.author}</span>
                    <span>{log.authorized ? '✓ Autorizado' : '✕ Bloqueado'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ================= MODAL: AUTHORIZE PROTECTED MODIFICATION ================= */}
      {showAuthModal && serverChallenge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 select-none">
          <div className="bg-slate-900 border border-amber-800/80 rounded-2xl max-w-md w-full shadow-2xl p-5 space-y-4 text-slate-100">
            <div className="flex items-center gap-2.5 text-amber-400">
              <Key className="w-5 h-5" />
              <h3 className="text-sm font-bold">Autorización Verificable en Servidor</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              La regla está bajo <strong className="text-white">PROTECCIÓN INMUTABLE</strong>. El servidor ha emitido un desafío criptográfico de un solo uso (TTL: 120s).
            </p>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-amber-200">
              {authDescription}
            </div>

            {/* Server-Issued Challenge Code Box */}
            <div className="p-3 bg-slate-950/90 rounded-xl border border-amber-900/60 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Código Emitido por el Servidor:</span>
                <button
                  type="button"
                  onClick={() => setUserTypedCode(serverChallenge.confirmationCode)}
                  className="text-emerald-400 hover:text-emerald-300 text-[10px] font-mono underline"
                >
                  Autocompletar
                </button>
              </div>
              <div className="font-mono text-sm font-bold text-emerald-400 bg-slate-900 p-2 rounded border border-emerald-800/80 tracking-wider text-center select-text">
                {serverChallenge.confirmationCode}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-300 block">
                Introduce el código exacto para validar la autorización en el servidor:
              </label>
              <input
                type="text"
                value={userTypedCode}
                onChange={(e) => setUserTypedCode(e.target.value.toUpperCase())}
                placeholder={serverChallenge.confirmationCode}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAuthModal(false);
                  setPendingAction(null);
                  setServerChallenge(null);
                }}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={userTypedCode.trim().toUpperCase() !== serverChallenge.confirmationCode.trim().toUpperCase()}
                onClick={handleConfirmAuthorization}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:hover:bg-amber-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Verificar y Ejecutar en Servidor</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CREATE GOAL ================= */}
      {showNewGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 select-none">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full shadow-2xl p-5 space-y-3.5 text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-400" />
                <span>Nuevo Objetivo Nexus</span>
              </h3>
              <button type="button" onClick={() => setShowNewGoalModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGoalSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Título del Objetivo</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="ej: Migración Arquitectónica de Datos"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Descripción Original Completa</label>
                <textarea
                  rows={2}
                  required
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Describe en detalle qué debe lograrse..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Resultado Esperado</label>
                <input
                  type="text"
                  value={newOutcome}
                  onChange={(e) => setNewOutcome(e.target.value)}
                  placeholder="ej: Base de datos desacoplada y validada"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-red-400 mb-1">Prohibiciones (una por línea)</label>
                <textarea
                  rows={2}
                  value={newProhibitions}
                  onChange={(e) => setNewProhibitions(e.target.value)}
                  placeholder="No borrar datos de prueba&#10;No usar dependencias deprecated"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-red-500 resize-none font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-blue-400 mb-1">Instrucciones Obligatorias (una por línea)</label>
                <textarea
                  rows={2}
                  value={newMandatory}
                  onChange={(e) => setNewMandatory(e.target.value)}
                  placeholder="Usar TypeScript estricto&#10;Documentar cada función pública"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-blue-500 resize-none font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-emerald-400 mb-1">Criterios de Éxito (uno por línea)</label>
                <textarea
                  rows={2}
                  value={newCriteria}
                  onChange={(e) => setNewCriteria(e.target.value)}
                  placeholder="Zero errores de linter&#10;Tiempo de respuesta menor a 200ms"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500 resize-none font-mono text-[11px]"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={newIsProtected}
                  onChange={(e) => setNewIsProtected(e.target.checked)}
                  className="accent-emerald-600"
                />
                <span className="text-slate-300 font-medium">Activar Protección Inmutable (Requiere autorización para editar)</span>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewGoalModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim() || !newDesc.trim()}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg"
                >
                  Guardar Objetivo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: PREVIEW INJECTED ENVELOPE ================= */}
      {showPreviewModal && previewEnvelope && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 select-none">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full shadow-2xl p-5 space-y-3 text-slate-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Sobre de Contexto Estructurado (ContextInjector)</h3>
              </div>
              <button type="button" onClick={() => setShowPreviewModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono py-1 border-b border-slate-800">
              <span>Prohibiciones: {previewEnvelope.injectedProhibitionsCount}</span>
              <span>Obligatorias: {previewEnvelope.injectedMandatoryCount}</span>
              <span>Criterios: {previewEnvelope.injectedCriteriaCount}</span>
              <span>Costo est.: ~{previewEnvelope.tokenCostEstimate} tokens</span>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-200/90 whitespace-pre-wrap leading-relaxed">
              {previewEnvelope.structuredContext}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs"
              >
                Cerrar Previsualización
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
