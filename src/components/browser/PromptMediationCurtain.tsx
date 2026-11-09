import React, { useState } from 'react';
import { Sparkles, ArrowRight, X, Check, Edit2, Shield, Eye, Flame } from 'lucide-react';
import { MediationAnalysisResult } from '../../services/mediationService';
import { AIPlatform, EvoMemoryProject } from '../../types/browser';

interface PromptMediationCurtainProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: MediationAnalysisResult | null;
  rawPrompt: string;
  platform: AIPlatform;
  activeProject: EvoMemoryProject;
  onApproveAndDispatch: (finalPrompt: string) => void;
  onSendOriginal: () => void;
}

export const PromptMediationCurtain: React.FC<PromptMediationCurtainProps> = ({
  isOpen,
  onClose,
  analysis,
  rawPrompt,
  platform,
  activeProject,
  onApproveAndDispatch,
  onSendOriginal,
}) => {
  const [editablePrompt, setEditablePrompt] = useState(analysis?.optimizedPrompt || rawPrompt);
  const [isEditing, setIsEditing] = useState(false);

  React.useEffect(() => {
    if (analysis?.optimizedPrompt) {
      setEditablePrompt(analysis.optimizedPrompt);
    } else {
      setEditablePrompt(rawPrompt);
    }
    setIsEditing(false);
  }, [analysis, rawPrompt]);

  if (!isOpen || !analysis) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Intervención Asistida EVO</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 font-mono border border-blue-800/80 uppercase">
                  {platform}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Proyecto: <span className="text-slate-200 font-medium">{activeProject.name}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Analysis Summary Row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 bg-slate-950/70 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-1">Intención Detectada:</span>
              <p className="font-semibold text-slate-200 truncate">{analysis.clarifiedIntent || 'Consulta directa'}</p>
            </div>
            <div className="p-2.5 bg-slate-950/70 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-1">Directivas Inyectadas:</span>
              <p className="font-semibold text-blue-300 truncate">
                {analysis.injectedConstraints?.length || 0} reglas de EVO Memory
              </p>
            </div>
            <div className="p-2.5 bg-emerald-950/30 rounded-xl border border-emerald-800/40">
              <span className="text-[10px] text-emerald-400 block mb-1">Ahorro de Tokens:</span>
              <p className="font-bold text-emerald-300 font-mono">
                ~{analysis.savingsPct || 15}% optimizado
              </p>
            </div>
          </div>

          {/* Reason */}
          <div className="p-3 bg-blue-950/30 border border-blue-900/50 rounded-xl text-blue-200/90 text-xs leading-relaxed">
            <strong className="text-blue-300 block mb-0.5">Motivo de la Mediación:</strong>
            {analysis.reasonForIntervention || 'Enriquecimiento preventivo con las restricciones del proyecto.'}
          </div>

          {/* Side-by-Side or Stacked Diff */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span>Comparación de Mensaje:</span>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="text-blue-400 hover:text-blue-300 text-[11px] flex items-center gap-1 font-normal"
              >
                <Edit2 className="w-3 h-3" />
                <span>{isEditing ? 'Guardar edición' : 'Editar texto optimizado'}</span>
              </button>
            </div>

            {/* Original */}
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-400">
              <span className="text-[10px] text-slate-500 font-sans uppercase font-bold block mb-1">
                Original escrito por ti:
              </span>
              <p className="whitespace-pre-wrap">{rawPrompt}</p>
            </div>

            {/* Optimized */}
            <div className="p-3 bg-blue-950/20 rounded-xl border border-blue-700/60 font-mono text-[11px] text-slate-100">
              <span className="text-[10px] text-blue-400 font-sans uppercase font-bold block mb-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Propuesta Optimizada por EVO para {platform.toUpperCase()}:
              </span>
              {isEditing ? (
                <textarea
                  rows={4}
                  value={editablePrompt}
                  onChange={(e) => setEditablePrompt(e.target.value)}
                  className="w-full bg-slate-950 border border-blue-500 rounded-lg p-2 text-xs text-white focus:outline-none resize-none font-mono"
                />
              ) : (
                <p className="whitespace-pre-wrap text-blue-100">{editablePrompt}</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-t border-slate-800">
          <button
            type="button"
            onClick={onSendOriginal}
            className="px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors"
          >
            Enviar Original Sin Cambios
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onApproveAndDispatch(editablePrompt)}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Aprobar y Despachar a la IA</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
