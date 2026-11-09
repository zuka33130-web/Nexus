import React from 'react';
import { Download, CheckCircle2, FileText, X } from 'lucide-react';
import { DownloadItem } from '../../types/browser';

interface DownloadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  downloads: DownloadItem[];
}

export const DownloadsModal: React.FC<DownloadsModalProps> = ({ isOpen, onClose, downloads }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[80vh] text-slate-100">
        <div className="flex items-center justify-between p-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Descargas y Archivos</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2 flex-1 overflow-y-auto">
          {downloads.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              <Download className="w-8 h-8 mx-auto mb-2 opacity-30 text-emerald-400" />
              <p>No hay descargas activas o completadas en esta sesión.</p>
            </div>
          ) : (
            downloads.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5 truncate mr-2">
                  <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                  <div className="truncate">
                    <p className="font-semibold text-slate-200 truncate">{item.filename}</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {(item.sizeBytes / 1024).toFixed(1)} KB · {item.url}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] text-emerald-400 font-medium">Completado</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
