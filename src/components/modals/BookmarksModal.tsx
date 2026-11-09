import React, { useState } from 'react';
import { Bookmark, Plus, Trash2, ExternalLink, X, Search } from 'lucide-react';
import { Bookmark as BookmarkType } from '../../types/browser';

interface BookmarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookmarks: BookmarkType[];
  onNavigate: (url: string) => void;
  onAddBookmark: (title: string, url: string, category: 'ai' | 'developer' | 'general') => void;
  onRemoveBookmark: (id: string) => void;
}

export const BookmarksModal: React.FC<BookmarksModalProps> = ({
  isOpen,
  onClose,
  bookmarks,
  onNavigate,
  onAddBookmark,
  onRemoveBookmark,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCategory, setNewCategory] = useState<'ai' | 'developer' | 'general'>('ai');

  if (!isOpen) return null;

  const filtered = bookmarks.filter(
    b => b.title.toLowerCase().includes(searchTerm.toLowerCase()) || b.url.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) return;
    onAddBookmark(newTitle.trim(), newUrl.trim(), newCategory);
    setNewTitle('');
    setNewUrl('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-slate-100">
        <div className="flex items-center justify-between p-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Administrador de Marcadores</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          {/* Add form */}
          <form onSubmit={handleAddSubmit} className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
            <span className="text-xs font-semibold text-slate-300">Añadir Nuevo Marcador</span>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Título del sitio"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none"
              />
              <input
                type="text"
                placeholder="https://ejemplo.com"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none"
              />
            </div>
            <div className="flex justify-between items-center pt-1">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-300"
              >
                <option value="ai">Categoría: IA & Asistentes</option>
                <option value="developer">Categoría: Desarrollador</option>
                <option value="general">Categoría: General</option>
              </select>
              <button
                type="submit"
                disabled={!newTitle.trim() || !newUrl.trim()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium"
              >
                Guardar Marcador
              </button>
            </div>
          </form>

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Filtrar marcadores..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          {/* List */}
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {filtered.map((bm) => (
              <div
                key={bm.id}
                className="flex items-center justify-between p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl hover:border-slate-700 transition-colors group"
              >
                <div
                  onClick={() => {
                    onNavigate(bm.url);
                    onClose();
                  }}
                  className="flex items-center gap-2.5 flex-1 cursor-pointer truncate mr-2"
                >
                  {bm.favicon ? (
                    <img src={bm.favicon} alt="" className="w-4 h-4 rounded-xs shrink-0" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full bg-slate-700 shrink-0" />
                  )}
                  <div className="truncate">
                    <p className="text-xs font-medium text-slate-200 truncate">{bm.title}</p>
                    <p className="text-[10px] text-slate-500 font-mono truncate">{bm.url}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase font-mono">
                    {bm.category}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveBookmark(bm.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 rounded transition-opacity"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
