export type AIPlatform = 'chatgpt' | 'claude' | 'gemini' | 'ollama' | 'generic';

export type MediationLevel = 'observation' | 'assistance' | 'mediation' | 'autonomous';

export interface BrowserTab {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  isMuted: boolean;
  aiPlatform: AIPlatform | null;
  history: string[];
  historyIndex: number;
  lastActiveAt: number;
}

export interface EvoDecision {
  id: string;
  timestamp: number;
  decision: string;
  rationale: string;
  alternativesConsidered?: string;
}

export interface EvoEpisodicMemory {
  id: string;
  timestamp: number;
  summary: string;
  keyTakeaway: string;
  tags: string[];
}

export interface EvoMemoryProject {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  lastActiveAt: number;
  permanentGoals: string[];
  strictConstraints: string[];
  techStack: string[];
  decisionLog: EvoDecision[];
  episodicMemories: EvoEpisodicMemory[];
}

export interface LoopWarning {
  isLoop: boolean;
  confidence: number;
  reason: string;
  repetitionCount: number;
  suggestedBreakout: string;
  previousFailedSolution?: string;
}

export interface InterceptionEvent {
  id: string;
  timestamp: number;
  tabId: string;
  type: 'input' | 'output';
  platform: AIPlatform;
  rawContent: string;
  enrichedContent?: string;
  reasonForIntervention?: string;
  status: 'pending' | 'approved' | 'modified' | 'rejected' | 'streamed' | 'completed';
  tokenStats?: {
    rawTokens: number;
    optimizedTokens: number;
    savingsPct: number;
  };
  loopWarning?: LoopWarning;
  diffSummary?: {
    clarifiedIntent?: string;
    injectedConstraints?: string[];
    removedRedundancy?: string[];
  };
}

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  category: 'ai' | 'developer' | 'general';
  createdAt: number;
}

export interface HistoryItem {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  visitedAt: number;
}

export interface DownloadItem {
  id: string;
  filename: string;
  url: string;
  sizeBytes: number;
  status: 'completed' | 'in_progress' | 'cancelled';
  progressPct: number;
  completedAt?: number;
}

export interface BrowserSettings {
  defaultSearchEngine: 'duckduckgo' | 'google' | 'bing';
  mediationLevel: MediationLevel;
  autoDetectLoops: boolean;
  autoInjectEvoMemory: boolean;
  ollamaEndpoint: string;
  enableProxyCache: boolean;
  stripCsp: boolean;
  isolatedSessions: boolean;
}
