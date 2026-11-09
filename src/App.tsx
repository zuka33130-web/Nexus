import React, { useState, useEffect, useCallback } from 'react';
import { 
  AIPlatform, Bookmark, BrowserSettings, BrowserTab, 
  DownloadItem, EvoMemoryProject, HistoryItem, InterceptionEvent, 
  MediationLevel 
} from './types/browser';
import { EvoMemoryStorageService } from './services/evoMemoryStorage';
import { MediationAnalysisResult, MediationService } from './services/mediationService';
import { BrowserChrome } from './components/browser/BrowserChrome';
import { BrowserViewport } from './components/browser/BrowserViewport';
import { EvoSidebar } from './components/panels/EvoSidebar';
import { PromptMediationCurtain } from './components/browser/PromptMediationCurtain';
import { BookmarksModal } from './components/modals/BookmarksModal';
import { HistoryModal } from './components/modals/HistoryModal';
import { DownloadsModal } from './components/modals/DownloadsModal';
import { SettingsModal } from './components/modals/SettingsModal';

const INITIAL_TABS: BrowserTab[] = [
  {
    id: 'tab_chatgpt',
    url: 'https://chatgpt.com',
    title: 'ChatGPT',
    favicon: 'https://chatgpt.com/favicon.ico',
    isLoading: false,
    canGoBack: false,
    canGoForward: false,
    isMuted: false,
    aiPlatform: 'chatgpt',
    history: ['https://chatgpt.com'],
    historyIndex: 0,
    lastActiveAt: Date.now(),
  },
  {
    id: 'tab_claude',
    url: 'https://claude.ai',
    title: 'Claude AI',
    favicon: 'https://claude.ai/favicon.ico',
    isLoading: false,
    canGoBack: false,
    canGoForward: false,
    isMuted: false,
    aiPlatform: 'claude',
    history: ['https://claude.ai'],
    historyIndex: 0,
    lastActiveAt: Date.now() - 1000,
  },
  {
    id: 'tab_gemini',
    url: 'https://gemini.google.com',
    title: 'Google Gemini',
    favicon: 'https://www.gstatic.com/lamda/images/favicon_v1_150160cddff7fcd001b41.svg',
    isLoading: false,
    canGoBack: false,
    canGoForward: false,
    isMuted: false,
    aiPlatform: 'gemini',
    history: ['https://gemini.google.com'],
    historyIndex: 0,
    lastActiveAt: Date.now() - 2000,
  },
];

export default function App() {
  // Persistent State
  const [projects, setProjects] = useState<EvoMemoryProject[]>(() => EvoMemoryStorageService.getProjects());
  const [activeProject, setActiveProject] = useState<EvoMemoryProject>(() => EvoMemoryStorageService.getActiveProject());
  const [settings, setSettings] = useState<BrowserSettings>(() => EvoMemoryStorageService.getSettings());
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => EvoMemoryStorageService.getBookmarks());
  const [history, setHistory] = useState<HistoryItem[]>(() => EvoMemoryStorageService.getHistory());
  const [interceptions, setInterceptions] = useState<InterceptionEvent[]>(() => EvoMemoryStorageService.getInterceptions());
  const [downloads] = useState<DownloadItem[]>([
    {
      id: 'dl_1',
      filename: 'evo-browser-architecture-spec.pdf',
      url: 'https://evobrowser.internal/spec.pdf',
      sizeBytes: 428000,
      status: 'completed',
      progressPct: 100,
      completedAt: Date.now() - 3600000,
    }
  ]);

  // Browser State
  const [tabs, setTabs] = useState<BrowserTab[]>(() => {
    const saved = EvoMemoryStorageService.getSavedTabs();
    return saved && saved.length > 0 ? saved : INITIAL_TABS;
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0]?.id || 'tab_chatgpt');
  const [viewMode, setViewMode] = useState<'proxy' | 'workstation'>('workstation');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Modals state
  const [showBookmarksModal, setShowBookmarksModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showDownloadsModal, setShowDownloadsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Prompt Mediation Curtain state (for Asistencia mode)
  const [curtainOpen, setCurtainOpen] = useState(false);
  const [curtainAnalysis, setCurtainAnalysis] = useState<MediationAnalysisResult | null>(null);
  const [curtainRawPrompt, setCurtainRawPrompt] = useState('');
  const [curtainPlatform, setCurtainPlatform] = useState<AIPlatform>('chatgpt');
  const [curtainSource, setCurtainSource] = useState<'proxy' | 'workstation'>('workstation');
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);
  const [approvedWorkstationPrompt, setApprovedWorkstationPrompt] = useState<{ prompt: string; id: number } | null>(null);

  // Save tabs on change
  useEffect(() => {
    EvoMemoryStorageService.saveTabs(tabs);
  }, [tabs]);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  // Detect AI Platform from URL
  const detectPlatformFromUrl = (url: string): AIPlatform | null => {
    if (url.includes('chatgpt.com') || url.includes('openai.com')) return 'chatgpt';
    if (url.includes('claude.ai') || url.includes('anthropic.com')) return 'claude';
    if (url.includes('gemini.google.com')) return 'gemini';
    if (url.includes('localhost:11434')) return 'ollama';
    return null;
  };

  // URL Normalizer & Search resolution
  const resolveUrl = (input: string): string => {
    const trimmed = input.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    // Check if it's a domain pattern
    if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+([/?#].*)?$/.test(trimmed)) {
      return `https://${trimmed}`;
    }
    // Search query
    const engine = settings.defaultSearchEngine;
    if (engine === 'google') {
      return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
    } else if (engine === 'bing') {
      return `https://www.bing.com/search?q=${encodeURIComponent(trimmed)}`;
    }
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  };

  // Navigate to URL
  const handleNavigate = useCallback((rawTarget: string) => {
    const targetUrl = resolveUrl(rawTarget);
    const platform = detectPlatformFromUrl(targetUrl);

    let siteTitle = targetUrl;
    try {
      const u = new URL(targetUrl);
      siteTitle = u.hostname.replace('www.', '');
    } catch {}

    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        const newHistory = [...t.history.slice(0, t.historyIndex + 1), targetUrl];
        return {
          ...t,
          url: targetUrl,
          title: siteTitle,
          isLoading: true,
          aiPlatform: platform,
          history: newHistory,
          historyIndex: newHistory.length - 1,
          canGoBack: newHistory.length > 1,
          canGoForward: false,
          lastActiveAt: Date.now(),
        };
      }
      return t;
    }));

    // Record in history
    EvoMemoryStorageService.addHistory(siteTitle, targetUrl);
    setHistory(EvoMemoryStorageService.getHistory());

    // Clear loading state after simulated transition
    setTimeout(() => {
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, isLoading: false } : t));
    }, 600);
  }, [activeTabId, settings.defaultSearchEngine]);

  // Go Back
  const handleGoBack = () => {
    if (!activeTab || activeTab.historyIndex <= 0) return;
    const newIdx = activeTab.historyIndex - 1;
    const prevUrl = activeTab.history[newIdx];
    const platform = detectPlatformFromUrl(prevUrl);

    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        return {
          ...t,
          url: prevUrl,
          historyIndex: newIdx,
          canGoBack: newIdx > 0,
          canGoForward: true,
          aiPlatform: platform,
        };
      }
      return t;
    }));
  };

  // Go Forward
  const handleGoForward = () => {
    if (!activeTab || activeTab.historyIndex >= activeTab.history.length - 1) return;
    const newIdx = activeTab.historyIndex + 1;
    const nextUrl = activeTab.history[newIdx];
    const platform = detectPlatformFromUrl(nextUrl);

    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        return {
          ...t,
          url: nextUrl,
          historyIndex: newIdx,
          canGoBack: true,
          canGoForward: newIdx < activeTab.history.length - 1,
          aiPlatform: platform,
        };
      }
      return t;
    }));
  };

  // Reload
  const handleReload = () => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, isLoading: true } : t));
    setTimeout(() => {
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, isLoading: false } : t));
    }, 400);
  };

  // New Tab
  const handleNewTab = () => {
    const newId = 'tab_' + Date.now();
    const newTab: BrowserTab = {
      id: newId,
      url: 'https://chatgpt.com',
      title: 'Nueva Pestaña',
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      isMuted: false,
      aiPlatform: 'chatgpt',
      history: ['https://chatgpt.com'],
      historyIndex: 0,
      lastActiveAt: Date.now(),
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
  };

  // Close Tab
  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) {
      // Don't close last tab; reset to home
      handleNavigate('https://chatgpt.com');
      return;
    }
    const idx = tabs.findIndex(t => t.id === id);
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) {
      const nextActive = newTabs[Math.max(0, idx - 1)];
      setActiveTabId(nextActive.id);
    }
  };

  // Toggle Bookmark
  const handleToggleBookmark = (tab: BrowserTab) => {
    const existing = bookmarks.find(b => b.url === tab.url);
    if (existing) {
      EvoMemoryStorageService.removeBookmark(existing.id);
    } else {
      EvoMemoryStorageService.addBookmark(tab.title, tab.url, tab.aiPlatform ? 'ai' : 'general');
    }
    setBookmarks(EvoMemoryStorageService.getBookmarks());
  };

  // EVO Memory Projects Management
  const handleSelectProject = (id: string) => {
    EvoMemoryStorageService.setActiveProjectId(id);
    setActiveProject(EvoMemoryStorageService.getActiveProject());
  };

  const handleUpdateProject = (updates: Partial<EvoMemoryProject>) => {
    const updated = EvoMemoryStorageService.updateActiveProject(updates);
    setActiveProject(updated);
    setProjects(EvoMemoryStorageService.getProjects());
  };

  const handleCreateProject = (name: string, description: string) => {
    const newProj: EvoMemoryProject = {
      id: 'proj_' + Date.now(),
      name,
      description,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      permanentGoals: ['Priorizar código robusto y tipado estricto'],
      strictConstraints: ['Evitar dependencias superfluas'],
      techStack: ['TypeScript', 'Node.js'],
      decisionLog: [],
      episodicMemories: [],
    };
    const updated = [newProj, ...projects];
    EvoMemoryStorageService.saveProjects(updated);
    EvoMemoryStorageService.setActiveProjectId(newProj.id);
    setProjects(updated);
    setActiveProject(newProj);
  };

  // Mediation Level Change
  const handleChangeMediationLevel = (level: MediationLevel) => {
    EvoMemoryStorageService.updateMediationLevel(level);
    setSettings(prev => ({ ...prev, mediationLevel: level }));
  };

  // -----------------------------------------------------------------
  // INTERCEPTION & MEDIATION HOOKS
  // -----------------------------------------------------------------

  const handleInterceptInput = async (
    rawPrompt: string, 
    platform: AIPlatform, 
    source: 'proxy' | 'workstation' = 'workstation'
  ) => {
    console.log(`[EVO Host] Input captured from ${source}:`, rawPrompt, 'on platform:', platform);

    // 1. Execute MediationService.analyzeInput() BEFORE allowing any dispatch
    const analysis = await MediationService.analyzeInput(rawPrompt, activeProject, settings.mediationLevel);

    const eventId = 'evt_in_' + Date.now();
    const event: InterceptionEvent = {
      id: eventId,
      timestamp: Date.now(),
      tabId: activeTabId,
      type: 'input',
      platform,
      rawContent: rawPrompt,
      enrichedContent: analysis.optimizedPrompt,
      reasonForIntervention: analysis.reasonForIntervention,
      status: settings.mediationLevel === 'assistance' ? 'pending' : 'approved',
      tokenStats: {
        rawTokens: analysis.rawTokensEstimated,
        optimizedTokens: analysis.optimizedTokensEstimated,
        savingsPct: analysis.savingsPct,
      },
      diffSummary: {
        clarifiedIntent: analysis.clarifiedIntent,
        injectedConstraints: analysis.injectedConstraints,
        removedRedundancy: analysis.removedRedundancy,
      },
    };

    EvoMemoryStorageService.addInterception(event);
    setInterceptions(EvoMemoryStorageService.getInterceptions());

    // 2. In assistance mode: HALT execution, display optimized proposal and wait for explicit user approval
    if (settings.mediationLevel === 'assistance') {
      setCurtainAnalysis(analysis);
      setCurtainRawPrompt(rawPrompt);
      setCurtainPlatform(platform);
      setCurtainSource(source);
      setPendingEventId(eventId);
      setCurtainOpen(true);
      return;
    }

    // 3. In mediation / autonomous mode: auto-dispatch exclusively the optimized prompt!
    if (settings.mediationLevel === 'mediation' || settings.mediationLevel === 'autonomous') {
      dispatchApprovedPrompt(analysis.optimizedPrompt, source);
      return;
    }

    // 4. In observation mode: pass original prompt without alteration
    if (settings.mediationLevel === 'observation') {
      if (source === 'proxy') {
        const iframe = document.querySelector('iframe');
        if (iframe && iframe.contentWindow) {
          MediationService.dispatchToBridge(iframe.contentWindow, rawPrompt, true);
        }
      }
    }
  };

  const handleStreamChunk = (chunk: string, platform: AIPlatform) => {
    // Progressive streaming observer
  };

  const handleStreamComplete = async (fullText: string, platform: AIPlatform) => {
    console.log('[EVO Host] Stream completed:', fullText.slice(0, 100), '...');

    // Run anti-loop detection
    const loopAnalysis = await MediationService.analyzeOutput(
      fullText,
      [{ role: 'assistant', content: fullText }],
      activeProject
    );

    const event: InterceptionEvent = {
      id: 'evt_out_' + Date.now(),
      timestamp: Date.now(),
      tabId: activeTabId,
      type: 'output',
      platform,
      rawContent: fullText,
      status: 'completed',
      tokenStats: {
        rawTokens: Math.ceil(fullText.length / 4),
        optimizedTokens: Math.ceil(fullText.length / 4),
        savingsPct: 0,
      },
      loopWarning: loopAnalysis.isLoop ? loopAnalysis : undefined,
    };

    EvoMemoryStorageService.addInterception(event);
    setInterceptions(EvoMemoryStorageService.getInterceptions());

    // Record episodic memory if non-looping milestone
    if (!loopAnalysis.isLoop && fullText.length > 200) {
      EvoMemoryStorageService.addEpisodicMemory(
        `Interacción en ${platform.toUpperCase()}: ${fullText.slice(0, 80)}...`,
        'Intercambio procesado y verificado por mediación EVO.',
        [platform, 'mediacion']
      );
      setActiveProject(EvoMemoryStorageService.getActiveProject());
    }
  };

  // Dispatch approved prompt to the correct target (Workstation or Web Proxy bridge)
  const dispatchApprovedPrompt = (finalPrompt: string, source: 'proxy' | 'workstation') => {
    console.log(`[EVO Host] Dispatching exclusively approved prompt to ${source}:`, finalPrompt);
    if (source === 'workstation') {
      setApprovedWorkstationPrompt({ prompt: finalPrompt, id: Date.now() });
    } else {
      const iframe = document.querySelector('iframe');
      if (iframe && iframe.contentWindow) {
        MediationService.dispatchToBridge(iframe.contentWindow, finalPrompt, true);
      }
    }
  };

  // Called when user clicks "Aprobar y Despachar a la IA" in the curtain
  const handleApproveAndDispatchPrompt = (finalPrompt: string) => {
    if (pendingEventId) {
      EvoMemoryStorageService.updateInterception(pendingEventId, {
        status: 'approved',
        enrichedContent: finalPrompt,
      });
      setInterceptions(EvoMemoryStorageService.getInterceptions());
    }
    dispatchApprovedPrompt(finalPrompt, curtainSource);
    setCurtainOpen(false);
    setPendingEventId(null);
  };

  // Called when user clicks "Cancelar" in the curtain: DO NOT SEND ANY MESSAGE!
  const handleCancelPrompt = () => {
    console.log('[EVO Host] User cancelled mediation. No prompt will be sent.');
    if (pendingEventId) {
      EvoMemoryStorageService.updateInterception(pendingEventId, { status: 'rejected' });
      setInterceptions(EvoMemoryStorageService.getInterceptions());
    }
    if (curtainSource === 'proxy') {
      const iframe = document.querySelector('iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ target: 'EVO_BRIDGE', action: 'CANCEL_PENDING_PROMPT' }, '*');
      }
    }
    setCurtainOpen(false);
    setPendingEventId(null);
  };

  // Called when user clicks "Enviar Original Sin Cambios"
  const handleSendOriginal = () => {
    console.log('[EVO Host] User chose to send original prompt.');
    if (pendingEventId) {
      EvoMemoryStorageService.updateInterception(pendingEventId, { status: 'approved' });
      setInterceptions(EvoMemoryStorageService.getInterceptions());
    }
    dispatchApprovedPrompt(curtainRawPrompt, curtainSource);
    setCurtainOpen(false);
    setPendingEventId(null);
  };

  // Listen to Bridge Messages from iframe
  useEffect(() => {
    const handleBridgeMessage = (event: MessageEvent) => {
      if (!event.data || event.data.source !== 'EVO_BRIDGE') return;
      const { type, payload } = event.data;

      if (type === 'INPUT_PROMPT_CAPTURED') {
        handleInterceptInput(payload.prompt, payload.platform || 'generic', 'proxy');
      } else if (type === 'STREAM_CHUNK') {
        handleStreamChunk(payload.chunk, payload.platform || 'generic');
      } else if (type === 'STREAM_COMPLETED') {
        handleStreamComplete(payload.fullText, payload.platform || 'generic');
      } else if (type === 'PAGE_LOADED') {
        setTabs(prev => prev.map(t => {
          if (t.id === activeTabId) {
            return {
              ...t,
              title: payload.title || t.title,
              isLoading: false,
              aiPlatform: payload.platform || t.aiPlatform,
            };
          }
          return t;
        }));
      }
    };

    window.addEventListener('message', handleBridgeMessage);
    return () => window.removeEventListener('message', handleBridgeMessage);
  }, [activeTabId, activeProject, settings.mediationLevel]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleNewTab();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (activeTabId) handleCloseTab(activeTabId, e as any);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setShowBookmarksModal(prev => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setShowHistoryModal(prev => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setIsSidebarOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, tabs]);

  const isBookmarked = Boolean(bookmarks.find(b => b.url === activeTab?.url));

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans text-slate-100 select-none">
      {/* 1. Browser Chrome: Tabs & Omnibox */}
      <BrowserChrome
        tabs={tabs}
        activeTabId={activeTabId}
        bookmarks={bookmarks}
        activeProject={activeProject}
        mediationLevel={settings.mediationLevel}
        isSidebarOpen={isSidebarOpen}
        viewMode={viewMode}
        onSelectTab={setActiveTabId}
        onCloseTab={handleCloseTab}
        onNewTab={handleNewTab}
        onNavigate={handleNavigate}
        onGoBack={handleGoBack}
        onGoForward={handleGoForward}
        onReload={handleReload}
        onToggleBookmark={handleToggleBookmark}
        isBookmarked={isBookmarked}
        onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        onToggleViewMode={() => setViewMode(prev => prev === 'proxy' ? 'workstation' : 'proxy')}
        onOpenBookmarks={() => setShowBookmarksModal(true)}
        onOpenHistory={() => setShowHistoryModal(true)}
        onOpenDownloads={() => setShowDownloadsModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
      />

      {/* 2. Main Content Split: Browser Viewport + EVO Sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        <BrowserViewport
          activeTab={activeTab}
          viewMode={viewMode}
          activeProject={activeProject}
          mediationLevel={settings.mediationLevel}
          onInterceptInput={handleInterceptInput}
          approvedWorkstationPrompt={approvedWorkstationPrompt}
          onStreamChunk={handleStreamChunk}
          onStreamComplete={handleStreamComplete}
          onTriggerBreakLoop={() => {
            setIsSidebarOpen(true);
          }}
        />

        <EvoSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          activeProject={activeProject}
          projects={projects}
          onSelectProject={handleSelectProject}
          onUpdateProject={handleUpdateProject}
          onCreateProject={handleCreateProject}
          mediationLevel={settings.mediationLevel}
          onChangeMediationLevel={handleChangeMediationLevel}
          interceptions={interceptions}
          onClearInterceptions={() => {
            EvoMemoryStorageService.clearInterceptions();
            setInterceptions([]);
          }}
          onDispatchPrompt={(prompt) => dispatchApprovedPrompt(prompt, viewMode)}
        />
      </div>

      {/* 3. Interactive Modals */}
      <PromptMediationCurtain
        isOpen={curtainOpen}
        onClose={handleCancelPrompt}
        analysis={curtainAnalysis}
        rawPrompt={curtainRawPrompt}
        platform={curtainPlatform}
        activeProject={activeProject}
        onApproveAndDispatch={handleApproveAndDispatchPrompt}
        onSendOriginal={handleSendOriginal}
      />

      <BookmarksModal
        isOpen={showBookmarksModal}
        onClose={() => setShowBookmarksModal(false)}
        bookmarks={bookmarks}
        onNavigate={handleNavigate}
        onAddBookmark={(title, url, category) => {
          EvoMemoryStorageService.addBookmark(title, url, category);
          setBookmarks(EvoMemoryStorageService.getBookmarks());
        }}
        onRemoveBookmark={(id) => {
          EvoMemoryStorageService.removeBookmark(id);
          setBookmarks(EvoMemoryStorageService.getBookmarks());
        }}
      />

      <HistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        history={history}
        onNavigate={handleNavigate}
        onClearHistory={() => {
          EvoMemoryStorageService.clearHistory();
          setHistory([]);
        }}
      />

      <DownloadsModal
        isOpen={showDownloadsModal}
        onClose={() => setShowDownloadsModal(false)}
        downloads={downloads}
      />

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={settings}
        onUpdateSettings={(updates) => {
          const updated = { ...settings, ...updates };
          EvoMemoryStorageService.saveSettings(updated);
          setSettings(updated);
        }}
      />
    </div>
  );
}
