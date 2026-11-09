import { EvoMemoryProject, InterceptionEvent, LoopWarning, MediationLevel } from '../types/browser';

export interface MediationAnalysisResult {
  clarifiedIntent: string;
  missingRequirements: string[];
  injectedConstraints: string[];
  removedRedundancy: string[];
  optimizedPrompt: string;
  reasonForIntervention: string;
  rawTokensEstimated: number;
  optimizedTokensEstimated: number;
  savingsPct: number;
}

export class MediationService {
  /**
   * Optimizes and checks user input against EVO Memory
   */
  static async analyzeInput(
    rawPrompt: string,
    projectContext: EvoMemoryProject,
    autonomyLevel: MediationLevel
  ): Promise<MediationAnalysisResult> {
    try {
      const resp = await fetch('/api/mediation/analyze-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawPrompt,
          projectContext,
          autonomyLevel,
        }),
      });

      if (!resp.ok) {
        throw new Error(`Mediation HTTP error ${resp.status}`);
      }

      const data = await resp.json();
      return data.analysis;
    } catch (err) {
      console.warn('[MediationService] Input analysis fallback', err);
      // Fallback heuristics if offline
      const cleaned = rawPrompt.replace(/^(hola|buenas|por favor|podrías|ayúdame a)\s*/i, '').trim();
      const constraints = projectContext.strictConstraints.slice(0, 2);
      const enriched = `${cleaned}\n\n[Directivas EVO Memory: ${constraints.join(' | ')}]`;
      return {
        clarifiedIntent: rawPrompt.slice(0, 60),
        missingRequirements: [],
        injectedConstraints: constraints,
        removedRedundancy: ['Preámbulo conversacional'],
        optimizedPrompt: enriched,
        reasonForIntervention: 'Incorporación de directivas estrictas de EVO Memory',
        rawTokensEstimated: Math.ceil(rawPrompt.length / 4),
        optimizedTokensEstimated: Math.ceil(enriched.length / 4),
        savingsPct: 15,
      };
    }
  }

  /**
   * Evaluates AI streaming/completed output for circular loops and errors
   */
  static async analyzeOutput(
    rawOutput: string,
    conversationTurns: Array<{ role: string; content: string }>,
    projectContext: EvoMemoryProject
  ): Promise<LoopWarning> {
    try {
      const resp = await fetch('/api/mediation/analyze-output', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawOutput,
          conversationTurns,
          projectContext,
        }),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      return data.loopAnalysis;
    } catch (err) {
      // Offline fallback: check simple lexical repetition
      const isRepeated = conversationTurns.some(
        t => t.role === 'assistant' && t.content.slice(0, 100) === rawOutput.slice(0, 100) && rawOutput.length > 50
      );
      return {
        isLoop: isRepeated,
        confidence: isRepeated ? 0.85 : 0.1,
        reason: isRepeated ? 'Detectada repetición exacta de respuesta previa.' : '',
        repetitionCount: isRepeated ? 2 : 0,
        suggestedBreakout: 'Por favor, detén este razonamiento y cambia el método de resolución.',
      };
    }
  }

  /**
   * Generates a "Break-the-Loop" prompt when circular reasoning is detected
   */
  static async generateBreakoutPrompt(
    loopReason: string,
    failedSolution: string,
    projectGoals: string
  ): Promise<string> {
    try {
      const resp = await fetch('/api/mediation/break-loop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loopReason,
          failedSolution,
          projectGoals,
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      return data.breakoutPrompt;
    } catch (err) {
      return `[INTERVENCIÓN EVO - RUPTURA DE BUCLE]: La solución propuesta ha fallado previamente. Detén este enfoque circular y aborda la causa raíz sin repetir la misma estrategia.`;
    }
  }

  /**
   * Checks Ollama status
   */
  static async checkOllama(endpoint: string = 'http://localhost:11434'): Promise<{
    online: boolean;
    models: any[];
    error?: string;
  }> {
    try {
      const resp = await fetch(`/api/ai/ollama/status?endpoint=${encodeURIComponent(endpoint)}`);
      return await resp.json();
    } catch (e: any) {
      return { online: false, models: [], error: e?.message || 'Error de conexión' };
    }
  }

  /**
   * Sends optimized prompt back to the target tab's iframe via postMessage
   */
  static dispatchToBridge(iframeWindow: Window, prompt: string, autoSubmit: boolean = false): void {
    try {
      iframeWindow.postMessage(
        {
          target: 'EVO_BRIDGE',
          action: 'INJECT_OPTIMIZED_PROMPT',
          prompt,
          autoSubmit,
        },
        '*'
      );
    } catch (e) {
      console.error('[MediationService] Dispatch to bridge error', e);
    }
  }
}
