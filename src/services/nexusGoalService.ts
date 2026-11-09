import { 
  AuditLogEntry, 
  ComplianceReport, 
  ContextInjectionResult, 
  GlobalInstructions, 
  NexusGoal, 
  PolicyConflict 
} from '../types/goals';

export class NexusGoalService {
  static async getGoals(): Promise<NexusGoal[]> {
    try {
      const resp = await fetch('/api/nexus/goals');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      return data.goals || [];
    } catch (e) {
      console.error('[NexusGoalService] getGoals error', e);
      return [];
    }
  }

  static async getActiveGoal(): Promise<NexusGoal | null> {
    try {
      const resp = await fetch('/api/nexus/goals/active');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      return data.activeGoal || null;
    } catch (e) {
      console.error('[NexusGoalService] getActiveGoal error', e);
      return null;
    }
  }

  static async createGoal(goalData: Partial<NexusGoal>): Promise<NexusGoal> {
    const resp = await fetch('/api/nexus/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(goalData),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${resp.status}`);
    }
    const data = await resp.json();
    return data.goal;
  }

  static async updateGoal(
    id: string, 
    updates: Partial<NexusGoal>, 
    explicitAuthorization: boolean = false
  ): Promise<NexusGoal> {
    const resp = await fetch(`/api/nexus/goals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates, explicitAuthorization }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${resp.status}`);
    }
    const data = await resp.json();
    return data.goal;
  }

  static async activateGoal(id: string): Promise<NexusGoal> {
    const resp = await fetch(`/api/nexus/goals/${id}/activate`, {
      method: 'POST',
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${resp.status}`);
    }
    const data = await resp.json();
    return data.goal;
  }

  static async deleteGoal(id: string, explicitAuthorization: boolean = false): Promise<boolean> {
    const resp = await fetch(`/api/nexus/goals/${id}?authorized=${explicitAuthorization}`, {
      method: 'DELETE',
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${resp.status}`);
    }
    return true;
  }

  static async getGlobalInstructions(): Promise<GlobalInstructions> {
    try {
      const resp = await fetch('/api/nexus/policies/global');
      const data = await resp.json();
      return data.globalInstructions;
    } catch (e) {
      console.error('[NexusGoalService] getGlobalInstructions error', e);
      throw e;
    }
  }

  static async saveGlobalInstructions(globalInstructions: GlobalInstructions, authorized: boolean = true): Promise<GlobalInstructions> {
    const resp = await fetch('/api/nexus/policies/global', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ globalInstructions, authorized }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${resp.status}`);
    }
    const data = await resp.json();
    return data.globalInstructions;
  }

  static async getConflicts(): Promise<{
    conflicts: PolicyConflict[];
    effectiveProhibitions: string[];
    effectiveMandatory: string[];
  }> {
    try {
      const resp = await fetch('/api/nexus/policies/conflicts');
      return await resp.json();
    } catch (e) {
      return { conflicts: [], effectiveProhibitions: [], effectiveMandatory: [] };
    }
  }

  static async getAuditLogs(limit: number = 100): Promise<AuditLogEntry[]> {
    try {
      const resp = await fetch(`/api/nexus/audit?limit=${limit}`);
      const data = await resp.json();
      return data.auditLogs || [];
    } catch (e) {
      return [];
    }
  }

  static async previewContextEnvelope(): Promise<ContextInjectionResult> {
    const resp = await fetch('/api/nexus/context/preview', {
      method: 'POST',
    });
    const data = await resp.json();
    return data.envelope;
  }

  static async validateCompliance(aiOutput: string): Promise<ComplianceReport> {
    const resp = await fetch('/api/nexus/compliance/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiOutput }),
    });
    const data = await resp.json();
    return data.report;
  }
}
