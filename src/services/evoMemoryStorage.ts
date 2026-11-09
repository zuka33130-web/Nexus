import { Bookmark, BrowserSettings, BrowserTab, EvoMemoryProject, HistoryItem, InterceptionEvent, MediationLevel } from '../types/browser';

const KEYS = {
  PROJECTS: 'evo_memory_projects',
  ACTIVE_PROJECT_ID: 'evo_active_project_id',
  SETTINGS: 'evo_browser_settings',
  BOOKMARKS: 'evo_browser_bookmarks',
  HISTORY: 'evo_browser_history',
  INTERCEPTIONS: 'evo_interceptions_log',
  SAVED_TABS: 'evo_saved_tabs',
};

const DEFAULT_SETTINGS: BrowserSettings = {
  defaultSearchEngine: 'duckduckgo',
  mediationLevel: 'assistance',
  autoDetectLoops: true,
  autoInjectEvoMemory: true,
  ollamaEndpoint: 'http://localhost:11434',
  enableProxyCache: true,
  stripCsp: true,
  isolatedSessions: true,
};

const DEFAULT_PROJECT: EvoMemoryProject = {
  id: 'proj_evo_browser',
  name: 'EVO Browser Engine',
  description: 'Desarrollo de navegación inteligente y mediación activa para interacciones con LLMs.',
  createdAt: Date.now() - 86400000 * 3,
  lastActiveAt: Date.now(),
  permanentGoals: [
    'Mantener respuestas concisas sin preámbulos ni disculpas vacías.',
    'Priorizar soluciones en TypeScript con tipado estricto sin usar `any`.',
    'Validar siempre la ausencia de bucles de razonamiento circular antes de proponer código.',
    'Preservar la compatibilidad con navegadores modernos y accesibilidad WCAG AA.'
  ],
  strictConstraints: [
    'NO instalar paquetes externos no autorizados sin justificación explícita.',
    'NO exponer credenciales ni claves privadas en el lado cliente.',
    'NO repetir soluciones que ya hayan arrojado errores en turnos anteriores del chat.'
  ],
  techStack: ['TypeScript', 'React 19', 'Express', 'Tailwind CSS v4', 'Google GenAI SDK'],
  decisionLog: [
    {
      id: 'dec_1',
      timestamp: Date.now() - 86400000 * 2,
      decision: 'Arquitectura Dual: Proxy Inverso Dinámico + Bridge DOM Inyectado',
      rationale: 'Permite eludir X-Frame-Options/CSP y a la vez instrumentar en tiempo real los eventos de red sin depender de extensiones privadas.',
      alternativesConsidered: 'Solo iframe (bloqueado por CSP) o Solo Desktop Electron (limita previsualización web).'
    },
    {
      id: 'dec_2',
      timestamp: Date.now() - 86400000 * 1,
      decision: 'Nivel Asistencia con Inspector de Modificaciones por defecto',
      rationale: 'El usuario mantiene el control total de qué instrucciones se enriquecen antes de despachar a la IA.',
      alternativesConsidered: 'Intervención silenciosa (vulnera confianza del usuario).'
    }
  ],
  episodicMemories: [
    {
      id: 'ep_1',
      timestamp: Date.now() - 86400000 * 2,
      summary: 'Resolución de bloqueo CSP en interfaces de chat',
      keyTakeaway: 'Reescribir cabeceras en stream express y aplicar streaming proxy en tiempo real.',
      tags: ['seguridad', 'proxy', 'csp']
    }
  ]
};

const DEFAULT_BOOKMARKS: Bookmark[] = [
  {
    id: 'bm_chatgpt',
    title: 'ChatGPT',
    url: 'https://chatgpt.com',
    favicon: 'https://chatgpt.com/favicon.ico',
    category: 'ai',
    createdAt: Date.now(),
  },
  {
    id: 'bm_claude',
    title: 'Claude AI',
    url: 'https://claude.ai',
    favicon: 'https://claude.ai/favicon.ico',
    category: 'ai',
    createdAt: Date.now(),
  },
  {
    id: 'bm_gemini',
    title: 'Google Gemini',
    url: 'https://gemini.google.com',
    favicon: 'https://www.gstatic.com/lamda/images/favicon_v1_150160cddff7fcd001b41.svg',
    category: 'ai',
    createdAt: Date.now(),
  },
  {
    id: 'bm_ollama',
    title: 'Ollama Local Host',
    url: 'http://localhost:11434',
    favicon: 'https://ollama.com/public/ollama.png',
    category: 'ai',
    createdAt: Date.now(),
  },
  {
    id: 'bm_github',
    title: 'GitHub',
    url: 'https://github.com',
    favicon: 'https://github.githubassets.com/favicons/favicon.svg',
    category: 'developer',
    createdAt: Date.now(),
  },
  {
    id: 'bm_hackernews',
    title: 'Hacker News',
    url: 'https://news.ycombinator.com',
    favicon: 'https://news.ycombinator.com/favicon.ico',
    category: 'developer',
    createdAt: Date.now(),
  },
  {
    id: 'bm_wikipedia',
    title: 'Wikipedia en Español',
    url: 'https://es.wikipedia.org',
    favicon: 'https://es.wikipedia.org/static/favicon/wikipedia.ico',
    category: 'general',
    createdAt: Date.now(),
  }
];

export class EvoMemoryStorageService {
  // Projects
  static getProjects(): EvoMemoryProject[] {
    try {
      const data = localStorage.getItem(KEYS.PROJECTS);
      if (!data) {
        this.saveProjects([DEFAULT_PROJECT]);
        return [DEFAULT_PROJECT];
      }
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [DEFAULT_PROJECT];
    } catch {
      return [DEFAULT_PROJECT];
    }
  }

  static saveProjects(projects: EvoMemoryProject[]): void {
    try {
      localStorage.setItem(KEYS.PROJECTS, JSON.stringify(projects));
    } catch (e) {
      console.error('Error saving projects', e);
    }
  }

  static getActiveProjectId(): string {
    const id = localStorage.getItem(KEYS.ACTIVE_PROJECT_ID);
    if (!id) {
      this.setActiveProjectId(DEFAULT_PROJECT.id);
      return DEFAULT_PROJECT.id;
    }
    return id;
  }

  static setActiveProjectId(id: string): void {
    localStorage.setItem(KEYS.ACTIVE_PROJECT_ID, id);
  }

  static getActiveProject(): EvoMemoryProject {
    const id = this.getActiveProjectId();
    const projects = this.getProjects();
    const found = projects.find(p => p.id === id);
    return found || projects[0] || DEFAULT_PROJECT;
  }

  static updateActiveProject(updates: Partial<EvoMemoryProject>): EvoMemoryProject {
    const projects = this.getProjects();
    const activeId = this.getActiveProjectId();
    const idx = projects.findIndex(p => p.id === activeId);
    if (idx >= 0) {
      projects[idx] = {
        ...projects[idx],
        ...updates,
        lastActiveAt: Date.now(),
      };
      this.saveProjects(projects);
      return projects[idx];
    }
    return DEFAULT_PROJECT;
  }

  static addDecision(decision: string, rationale: string, alternativesConsidered?: string): void {
    const active = this.getActiveProject();
    const newDecision = {
      id: 'dec_' + Date.now(),
      timestamp: Date.now(),
      decision,
      rationale,
      alternativesConsidered,
    };
    this.updateActiveProject({
      decisionLog: [newDecision, ...active.decisionLog],
    });
  }

  static addEpisodicMemory(summary: string, keyTakeaway: string, tags: string[] = []): void {
    const active = this.getActiveProject();
    const newMemory = {
      id: 'ep_' + Date.now(),
      timestamp: Date.now(),
      summary,
      keyTakeaway,
      tags,
    };
    this.updateActiveProject({
      episodicMemories: [newMemory, ...active.episodicMemories],
    });
  }

  // Settings
  static getSettings(): BrowserSettings {
    try {
      const data = localStorage.getItem(KEYS.SETTINGS);
      if (!data) {
        this.saveSettings(DEFAULT_SETTINGS);
        return DEFAULT_SETTINGS;
      }
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  static saveSettings(settings: BrowserSettings): void {
    try {
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving settings', e);
    }
  }

  static updateMediationLevel(level: MediationLevel): void {
    const s = this.getSettings();
    s.mediationLevel = level;
    this.saveSettings(s);
  }

  // Bookmarks
  static getBookmarks(): Bookmark[] {
    try {
      const data = localStorage.getItem(KEYS.BOOKMARKS);
      if (!data) {
        this.saveBookmarks(DEFAULT_BOOKMARKS);
        return DEFAULT_BOOKMARKS;
      }
      return JSON.parse(data);
    } catch {
      return DEFAULT_BOOKMARKS;
    }
  }

  static saveBookmarks(bookmarks: Bookmark[]): void {
    localStorage.setItem(KEYS.BOOKMARKS, JSON.stringify(bookmarks));
  }

  static addBookmark(title: string, url: string, category: 'ai' | 'developer' | 'general' = 'general'): Bookmark {
    const bookmarks = this.getBookmarks();
    const newBm: Bookmark = {
      id: 'bm_' + Date.now(),
      title,
      url,
      category,
      createdAt: Date.now(),
    };
    bookmarks.push(newBm);
    this.saveBookmarks(bookmarks);
    return newBm;
  }

  static removeBookmark(id: string): void {
    const bookmarks = this.getBookmarks().filter(b => b.id !== id);
    this.saveBookmarks(bookmarks);
  }

  // History
  static getHistory(): HistoryItem[] {
    try {
      const data = localStorage.getItem(KEYS.HISTORY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static addHistory(title: string, url: string): void {
    try {
      const history = this.getHistory();
      const newHistory: HistoryItem = {
        id: 'hist_' + Date.now(),
        title: title || url,
        url,
        visitedAt: Date.now(),
      };
      // Keep recent 200 items, dedup consecutive
      if (history.length > 0 && history[0].url === url) {
        history[0].visitedAt = Date.now();
        localStorage.setItem(KEYS.HISTORY, JSON.stringify(history));
        return;
      }
      const updated = [newHistory, ...history].slice(0, 200);
      localStorage.setItem(KEYS.HISTORY, JSON.stringify(updated));
    } catch (e) {
      console.error('Error adding history', e);
    }
  }

  static clearHistory(): void {
    localStorage.removeItem(KEYS.HISTORY);
  }

  // Interceptions
  static getInterceptions(): InterceptionEvent[] {
    try {
      const data = localStorage.getItem(KEYS.INTERCEPTIONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static addInterception(event: InterceptionEvent): void {
    try {
      const list = this.getInterceptions();
      const updated = [event, ...list].slice(0, 100);
      localStorage.setItem(KEYS.INTERCEPTIONS, JSON.stringify(updated));
    } catch (e) {
      console.error('Error adding interception', e);
    }
  }

  static updateInterception(id: string, updates: Partial<InterceptionEvent>): void {
    try {
      const list = this.getInterceptions();
      const idx = list.findIndex(e => e.id === id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...updates };
        localStorage.setItem(KEYS.INTERCEPTIONS, JSON.stringify(list));
      }
    } catch (e) {
      console.error('Error updating interception', e);
    }
  }

  static clearInterceptions(): void {
    localStorage.removeItem(KEYS.INTERCEPTIONS);
  }

  // Saved tabs
  static getSavedTabs(): BrowserTab[] | null {
    try {
      const data = localStorage.getItem(KEYS.SAVED_TABS);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  static saveTabs(tabs: BrowserTab[]): void {
    try {
      localStorage.setItem(KEYS.SAVED_TABS, JSON.stringify(tabs));
    } catch (e) {
      console.error('Error saving tabs', e);
    }
  }
}
