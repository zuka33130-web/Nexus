import React, { useState } from 'react';
import { 
  ArrowLeft, ArrowRight, RotateCw, Home, Shield, Lock, Star, 
  Plus, X, ExternalLink, Bookmark as BookmarkIcon, Clock, 
  Download, Settings, PanelRight, Bot, Sparkles, Terminal, Check
} from 'lucide-react';
import { Bookmark, BrowserTab, EvoMemoryProject, MediationLevel } from '../../types/browser';

interface BrowserChromeProps {
  tabs: BrowserTab[];
  activeTabId: string;
  bookmarks: Bookmark[];
  activeProject: EvoMemoryProject;
  mediationLevel: MediationLevel;
  isSidebarOpen: boolean;
  viewMode: 'proxy' | 'workstation';
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string, e: React.MouseEvent) => void;
  onNewTab: () => void;
  onNavigate: (url: string) => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onReload: () => void;
  onToggleBookmark: (tab: BrowserTab) => void;
  isBookmarked: boolean;
  onToggleSidebar: () => void;
  onToggleViewMode: () => void;
  onOpenHistory: () => void;
  onOpenBookmarks: () => void;
  onOpenDownloads: () => void;
  onOpenSettings: () => void;
}

export const BrowserChrome: React.FC<BrowserChromeProps> = ({
  tabs,
  activeTabId,
  bookmarks,
  activeProject,
  mediationLevel,
  isSidebarOpen,
  viewMode,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onNavigate,
  onGoBack,
  onGoForward,
  onReload,
  onToggleBookmark,
  isBookmarked,
  onToggleSidebar,
  onToggleViewMode,
  onOpenHistory,
  onOpenBookmarks,
  onOpenDownloads,
  onOpenSettings,
}) => {
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const [omniboxInput, setOmniboxInput] = useState(activeTab?.url || '');
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Keep omnibox synced when active tab changes
  React.useEffect(() => {
    if (activeTab) {
      setOmniboxInput(activeTab.url);
    }
  }, [activeTab?.id, activeTab?.url]);

  const handleOmniboxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!omniboxInput.trim()) return;
    onNavigate(omniboxInput.trim());
  };

  const handleCopyUrl = () => {
    if (activeTab?.url) {
      navigator.clipboard.writeText(activeTab.url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 1500);
    }
  };

  const getMediationBadge = () => {
    switch (mediationLevel) {
      case 'autonomous':
        return { label: 'Autónomo', color: 'text-amber-400 bg-amber-950/60 border-amber-800/60' };
      case 'mediation':
        return { label: 'Mediación', color: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60' };
      case 'assistance':
        return { label: 'Asistencia', color: 'text-blue-400 bg-blue-950/60 border-blue-800/60' };
      case 'observation':
      default:
        return { label: 'Observación', color: 'text-slate-400 bg-slate-900 border-slate-700' };
    }
  };

  const badge = getMediationBadge();

  return (
    <div className="flex flex-col bg-slate-950 border-b border-slate-800/80 text-slate-200 select-none shrink-0">
      {/* 1. Tab Bar Row */}
      <div className="flex items-center justify-between px-2 pt-2 gap-2 overflow-hidden bg-slate-950/90">
        {/* Tabs Scroll Container */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[calc(100vw-360px)]">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`group relative flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-t-lg cursor-pointer transition-all border-t border-x ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-700/80 shadow-sm'
                    : 'bg-slate-950/50 text-slate-400 border-transparent hover:bg-slate-900/40 hover:text-slate-200'
                } min-w-[140px] max-w-[200px]`}
              >
                {/* Favicon or fallback */}
                <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                  {tab.isLoading ? (
                    <RotateCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  ) : tab.aiPlatform ? (
                    <Bot className="w-3.5 h-3.5 text-emerald-400" />
                  ) : tab.favicon ? (
                    <img 
                      src={tab.favicon} 
                      alt="" 
                      className="w-3.5 h-3.5 rounded-xs" 
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full bg-slate-700/60 flex items-center justify-center text-[9px]">
                      {tab.title ? tab.title.charAt(0).toUpperCase() : 'W'}
                    </div>
                  )}
                </div>

                {/* Title */}
                <span className="truncate flex-1 text-[11px] font-medium leading-none">
                  {tab.title || 'Nueva pestaña'}
                </span>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={(e) => onCloseTab(tab.id, e)}
                  className="opacity-0 group-hover:opacity-100 hover:bg-slate-800 p-0.5 rounded-xs text-slate-400 hover:text-white transition-opacity"
                  title="Cerrar pestaña"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {/* New Tab Button */}
          <button
            type="button"
            onClick={onNewTab}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-md transition-colors"
            title="Nueva pestaña (Ctrl+T)"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Right Header Status: Project & EVO Mode */}
        <div className="flex items-center gap-2.5 pr-2 shrink-0">
          {/* Active Project Pill */}
          <div 
            onClick={onToggleSidebar}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-md text-[11px] font-medium text-slate-300 hover:border-slate-700 cursor-pointer transition-colors"
            title="Proyecto activo en EVO MEMORY"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span className="truncate max-w-[130px]">{activeProject.name}</span>
          </div>

          {/* Mediation Level Badge */}
          <button
            type="button"
            onClick={onToggleSidebar}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase border transition-colors ${badge.color}`}
            title="Nivel de mediación activo"
          >
            <Sparkles className="w-3 h-3" />
            <span>{badge.label}</span>
          </button>
        </div>
      </div>

      {/* 2. Navigation Bar (Omnibox Row) */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-t border-slate-800/60">
        {/* Navigation Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onGoBack}
            disabled={!activeTab?.canGoBack}
            className={`p-1.5 rounded-md transition-colors ${
              activeTab?.canGoBack 
                ? 'text-slate-300 hover:text-white hover:bg-slate-800' 
                : 'text-slate-600 cursor-not-allowed'
            }`}
            title="Atrás (Alt+Left)"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onGoForward}
            disabled={!activeTab?.canGoForward}
            className={`p-1.5 rounded-md transition-colors ${
              activeTab?.canGoForward 
                ? 'text-slate-300 hover:text-white hover:bg-slate-800' 
                : 'text-slate-600 cursor-not-allowed'
            }`}
            title="Adelante (Alt+Right)"
          >
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onReload}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            title="Recargar página (F5)"
          >
            <RotateCw className={`w-4 h-4 ${activeTab?.isLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('https://chatgpt.com')}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            title="Página de inicio EVO"
          >
            <Home className="w-4 h-4" />
          </button>
        </div>

        {/* Omnibox / Address Bar */}
        <form onSubmit={handleOmniboxSubmit} className="flex-1 flex items-center relative">
          <div className="w-full flex items-center bg-slate-950 border border-slate-800 hover:border-slate-700 focus-within:border-blue-500/80 focus-within:ring-1 focus-within:ring-blue-500/30 rounded-lg px-2.5 py-1.5 text-xs transition-all">
            {/* Security Indicator */}
            <div className="flex items-center gap-1.5 pr-2 border-r border-slate-800 text-slate-400 shrink-0">
              {activeTab?.url.startsWith('https') ? (
                <span title="Conexión Segura HTTPS">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                </span>
              ) : (
                <span title="Protegido por EVO Proxy Shield">
                  <Shield className="w-3.5 h-3.5 text-blue-400" />
                </span>
              )}
              {activeTab?.aiPlatform && (
                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                  {activeTab.aiPlatform}
                </span>
              )}
            </div>

            {/* Input Field */}
            <input
              type="text"
              value={omniboxInput}
              onChange={(e) => setOmniboxInput(e.target.value)}
              placeholder="Escribe una URL o busca en la web..."
              className="w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none px-2 font-mono text-xs"
            />

            {/* Bookmark Star & Copy */}
            <div className="flex items-center gap-1 pl-1 shrink-0 text-slate-400">
              <button
                type="button"
                onClick={handleCopyUrl}
                className="p-1 hover:text-white hover:bg-slate-800/80 rounded transition-colors"
                title="Copiar URL"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ExternalLink className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => onToggleBookmark(activeTab)}
                className={`p-1 rounded transition-colors ${
                  isBookmarked 
                    ? 'text-amber-400 fill-amber-400' 
                    : 'hover:text-amber-400'
                }`}
                title={isBookmarked ? 'Quitar de marcadores' : 'Añadir a marcadores'}
              >
                <Star className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-400' : ''}`} />
              </button>
            </div>
          </div>
        </form>

        {/* View Mode Switcher: Workstation vs Web Proxy */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onToggleViewMode}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'workstation'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Workstation Integrada con Mediación en Vivo"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Workstation AI</span>
          </button>
          <button
            type="button"
            onClick={onToggleViewMode}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'proxy'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Navegación Web Real con Proxy Inverso Dinámico"
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Navegador Web</span>
          </button>
        </div>

        {/* Chrome Utilities */}
        <div className="flex items-center gap-0.5 shrink-0 text-slate-400 border-l border-slate-800 pl-1.5">
          <button
            type="button"
            onClick={onOpenBookmarks}
            className="p-1.5 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            title="Marcadores"
          >
            <BookmarkIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onOpenHistory}
            className="p-1.5 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            title="Historial de navegación"
          >
            <Clock className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onOpenDownloads}
            className="p-1.5 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            title="Descargas"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-1.5 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            title="Configuración de EVO"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onToggleSidebar}
            className={`p-1.5 rounded-md transition-colors ${
              isSidebarOpen 
                ? 'text-blue-400 bg-blue-950/60 border border-blue-800/60' 
                : 'hover:text-white hover:bg-slate-800'
            }`}
            title="Alternar Panel Lateral EVO"
          >
            <PanelRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. Bookmarks Bar Row */}
      <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-950/70 border-t border-slate-800/40 text-[11px] overflow-x-auto no-scrollbar">
        {bookmarks.slice(0, 8).map((bm) => (
          <button
            key={bm.id}
            type="button"
            onClick={() => onNavigate(bm.url)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-900 whitespace-nowrap transition-colors"
          >
            {bm.favicon ? (
              <img 
                src={bm.favicon} 
                alt="" 
                className="w-3 h-3 rounded-xs shrink-0" 
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            )}
            <span>{bm.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
