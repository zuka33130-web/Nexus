export type GoalStatus = 'active' | 'draft' | 'archived' | 'completed';

export interface NexusGoal {
  id: string;
  title: string;
  description: string;
  expectedOutcome: string;
  prohibitions: string[];
  mandatoryInstructions: string[];
  constraints: string[];
  successCriteria: string[];
  status: GoalStatus;
  version: number;
  createdAt: number;
  updatedAt: number;
  isProtected: boolean;
  scope: 'global' | 'project_specific';
  projectId?: string;
}

export interface GlobalInstructions {
  prohibitions: string[];
  mandatoryInstructions: string[];
  constraints: string[];
  updatedAt: number;
}

export interface PolicyConflict {
  id: string;
  timestamp: number;
  type: 'contradiction' | 'priority_collision' | 'unauthorized_mutation' | 'scope_leak';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  conflictingRules: string[];
  resolvedBy: 'policy_resolver' | 'user';
  resolution: string;
}

export interface ComplianceReport {
  isCompliant: boolean;
  score: number;
  violatedProhibitions: string[];
  omittedInstructions: string[];
  unmetCriteria: string[];
  deviations: string[];
  recommendation: string;
  evaluationMode: 'semantic_gemini' | 'heuristic_fallback';
  evaluatorDetails: string;
}

export interface AuthorizationChallenge {
  challengeToken: string;
  confirmationCode: string;
  action: 'update' | 'delete' | 'global_update' | 'unprotect';
  goalId?: string;
  expiresAt: number;
  prompt: string;
}

export interface AuthorizationVerificationRequest {
  challengeToken: string;
  confirmationCode: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  action: 
    | 'create' 
    | 'edit' 
    | 'activate' 
    | 'protect' 
    | 'unprotect' 
    | 'authorize_modification' 
    | 'reject_unauthorized' 
    | 'validation_violation' 
    | 'context_injected'
    | 'conflict_detected'
    | 'challenge_issued'
    | 'challenge_verified';
  goalId?: string;
  details: string;
  author: string;
  authorized: boolean;
  diff?: {
    before?: any;
    after?: any;
  };
}

export interface ContextInjectionResult {
  structuredContext: string;
  activeGoalTitle: string;
  injectedProhibitionsCount: number;
  injectedMandatoryCount: number;
  injectedCriteriaCount: number;
  tokenCostEstimate: number;
}

