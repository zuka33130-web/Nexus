import React from 'react';
import { Settings, Shield, Lock, Eye, Database, Globe, X } from 'lucide-react';
import { BrowserSettings, MediationLevel } from '../../types/browser';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: BrowserSettings;
  onUpdateSettings: (updates: Partial<BrowserSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-slate-100">
        <div className="flex items-center justify-between p-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white">Configuración de EVO Browser</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto text-xs">
          {/* Autonomy Level */}
          <div className="space-y-1.5 p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">Nivel de Mediación por Defecto</span>
            </div>
            <select
              value={settings.mediationLevel}
              onChange={(e) => onUpdateSettings({ mediationLevel: e.target.value as MediationLevel })}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white"
            >
              <option value="assistance">Asistencia (Recomienda mejoras antes de enviar)</option>
              <option value="observation">Observación (Solo monitorea sin alterar mensajes)</option>
              <option value="mediation">Mediación (Optimiza automáticamente con EVO Memory)</option>
              <option value="autonomous">Intervención Autónoma (Auto-reintentos y ruptura de bucles)</option>
            </select>
          </div>

          {/* Search Engine */}
          <div className="space-y-1.5 p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">Motor de Búsqueda de la Omnibox</span>
            </div>
            <select
              value={settings.defaultSearchEngine}
              onChange={(e) => onUpdateSettings({ defaultSearchEngine: e.target.value as any })}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white"
            >
              <option value="duckduckgo">DuckDuckGo (Privacidad Máxima)</option>
              <option value="google">Google Search</option>
              <option value="bing">Microsoft Bing</option>
            </select>
          </div>

          {/* Toggles */}
          <div className="space-y-2.5 p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <span className="font-semibold text-slate-200 block mb-1">Políticas de Mediación y Seguridad</span>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-slate-300 font-medium">Detector Antibucle Activo</p>
                <p className="text-[10px] text-slate-500">Supervisa circularidad y propone ruptura cognitiva inmediata.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoDetectLoops}
                onChange={(e) => onUpdateSettings({ autoDetectLoops: e.target.checked })}
                className="rounded accent-blue-600"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-slate-300 font-medium">Inyección Automática de EVO Memory</p>
                <p className="text-[10px] text-slate-500">Incorpora restricciones del proyecto en cada prompt interceptado.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoInjectEvoMemory}
                onChange={(e) => onUpdateSettings({ autoInjectEvoMemory: e.target.checked })}
                className="rounded accent-blue-600"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-slate-300 font-medium">Despojo de CSP & Anti-Iframe</p>
                <p className="text-[10px] text-slate-500">Neutraliza directivas frame-ancestors en el proxy inverso.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.stripCsp}
                onChange={(e) => onUpdateSettings({ stripCsp: e.target.checked })}
                className="rounded accent-blue-600"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-slate-300 font-medium">Aislamiento de Sesiones y Cookies</p>
                <p className="text-[10px] text-slate-500">Separación estricta de cookies entre cada plataforma de IA.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.isolatedSessions}
                onChange={(e) => onUpdateSettings({ isolatedSessions: e.target.checked })}
                className="rounded accent-blue-600"
              />
            </label>
          </div>

          {/* Localhost Ollama Endpoint */}
          <div className="space-y-1.5 p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <span className="font-semibold text-slate-200">Endpoint Local de Ollama</span>
            <input
              type="text"
              value={settings.ollamaEndpoint}
              onChange={(e) => onUpdateSettings({ ollamaEndpoint: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-white"
            />
          </div>
        </div>

        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
          >
            Guardar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
