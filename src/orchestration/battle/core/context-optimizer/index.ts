/**
 * Context Optimizer
 * Intelligent context compression and relevance scoring
 * 
 * Key patterns:
 * - Adaptive context window management
 * - Relevance-based pruning
 * - Model-specific context optimization
 * - Incremental context building for long workflows
 */

export interface ContextWindow {
  size: number;
  used: number;
  available: number;
}

export interface OptimizedContext {
  prompt: string;
  compressed: string;
  relevantFiles: string[];
  temperature: number;
  metadata: ContextMetadata;
}

export interface ContextMetadata {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  relevanceScores: Map<string, number>;
  pruned: string[];
}

export class ContextOptimizer {
  private strategy: 'aggressive' | 'balanced' | 'conservative';
  private modelContextLimits: Map<string, number>;

  constructor(strategy: 'aggressive' | 'balanced' | 'conservative' = 'balanced') {
    this.strategy = strategy;
    this.modelContextLimits = this.initializeContextLimits();
  }

  /**
   * Optimize context for a specific task and model
   * Key insight: Different tasks need different context
   */
  async optimize(task: any): Promise<OptimizedContext> {
    console.log(`[ContextOptimizer] Optimizing context for ${task.type} task`);

    // Step 1: Gather all available context
    const rawContext = await this.gatherContext(task);

    // Step 2: Score relevance of each context piece
    const scored = await this.scoreRelevance(rawContext, task);

    // Step 3: Prune low-relevance items
    const pruned = this.pruneByRelevance(scored);

    // Step 4: Compress remaining context
    const compressed = await this.compress(pruned);

    // Step 5: Build optimized prompt
    const prompt = this.buildPrompt(task, compressed);

    return {
      prompt,
      compressed: compressed.content,
      relevantFiles: compressed.files,
      temperature: this.selectTemperature(task.type),
      metadata: {
        originalSize: rawContext.length,
        compressedSize: compressed.content.length,
        compressionRatio: compressed.content.length / rawContext.length,
        relevanceScores: scored,
        pruned: pruned.removed
      }
    };
  }

  /**
   * Get agent-specific context (per sub-agent)
   */
  async getAgentContext(agent: any): Promise<OptimizedContext> {
    // Each agent gets context tailored to its specialization
    const contextWindow = this.modelContextLimits.get(agent.model) || 100000;

    // Specialization-specific context
    const contextStrategy = this.getStrategyForSpecialization(agent.specialization);

    return await this.optimize({
      type: agent.specialization,
      description: `Agent ${agent.id} - ${agent.specialization}`,
      context: contextStrategy
    });
  }

  /**
   * Gather all available context
   */
  private async gatherContext(task: any): Promise<string> {
    const sources = [];

    // Task description
    sources.push(`Task: ${task.description}`);

    // Relevant code files
    if (task.context?.relevant_code) {
      sources.push(...task.context.relevant_code);
    }

    // Documentation
    if (task.context?.documentation) {
      sources.push(...task.context.documentation);
    }

    // Prior attempts (learning from failures)
    if (task.context?.prior_attempts) {
      sources.push('Prior attempts:', ...task.context.prior_attempts);
    }

    // User preferences
    if (task.context?.user_preferences) {
      sources.push('User preferences:', JSON.stringify(task.context.user_preferences));
    }

    return sources.join('\n\n');
  }

  /**
   * Score relevance using semantic similarity
   * High relevance = include, low relevance = prune
   */
  private async scoreRelevance(
    context: string,
    task: any
  ): Promise<Map<string, number>> {
    const scores = new Map<string, number>();
    const sections = context.split('\n\n');

    for (const section of sections) {
      // Calculate relevance score (0.0 to 1.0)
      const score = await this.calculateSemanticSimilarity(section, task.description);
      scores.set(section, score);
    }

    return scores;
  }

  /**
   * Prune low-relevance context based on strategy
   */
  private pruneByRelevance(scored: Map<string, number>): { kept: string[]; removed: string[] } {
    const threshold = this.getRelevanceThreshold();
    const kept: string[] = [];
    const removed: string[] = [];

    for (const [section, score] of scored.entries()) {
      if (score >= threshold) {
        kept.push(section);
      } else {
        removed.push(section);
        console.log(`[ContextOptimizer] Pruned (score ${score.toFixed(2)}): ${section.substring(0, 50)}...`);
      }
    }

    console.log(`[ContextOptimizer] Kept ${kept.length} sections, pruned ${removed.length}`);
    return { kept, removed };
  }

  /**
   * Compress context using summarization
   */
  private async compress(pruned: { kept: string[]; removed: string[] }): Promise<{
    content: string;
    files: string[];
  }> {
    // For coding tasks, preserve full code
    // For research tasks, summarize aggressively

    const content = pruned.kept.join('\n\n');

    // Extract file references
    const files = this.extractFileReferences(content);

    return { content, files };
  }

  /**
   * Build optimized prompt for the task
   */
  private buildPrompt(task: any, compressed: { content: string; files: string[] }): string {
    const systemPrompt = this.getSystemPromptForTask(task.type);

    return `${systemPrompt}

## Task
${task.description}

## Context
${compressed.content}

## Requirements
- Follow HeadyBattle quality standards
- Write clean, maintainable code
- Include error handling
- Add inline comments for complex logic

## Output Format
Provide complete, production-ready code.
`;
  }

  /**
   * Temperature selection based on task type
   */
  private selectTemperature(taskType: string): number {
    const temperatureMap = {
      'coding': 0.2,         // Low temperature for deterministic code
      'research': 0.7,       // Higher for creative research
      'validation': 0.0,     // Zero for strict validation
      'optimization': 0.3    // Low-medium for optimization
    };

    return temperatureMap[taskType] || 0.5;
  }

  private getRelevanceThreshold(): number {
    const thresholds = {
      'aggressive': 0.7,   // Keep only highly relevant
      'balanced': 0.5,     // Keep moderately relevant
      'conservative': 0.3  // Keep most context
    };
    return thresholds[this.strategy];
  }

  private initializeContextLimits(): Map<string, number> {
    return new Map([
      ['claude-opus-4-6', 200000],
      ['claude-sonnet-4-5', 200000],
      ['gpt-5-4-turbo', 128000],
      ['gemini-3-1-pro', 1000000],
      ['o1', 200000]
    ]);
  }

  private getSystemPromptForTask(taskType: string): string {
    const prompts = {
      'coding': 'You are an expert software engineer. Write clean, maintainable, well-tested code.',
      'research': 'You are a deep researcher. Provide comprehensive, well-sourced analysis.',
      'validation': 'You are a code reviewer. Check for bugs, security issues, and quality problems.',
      'optimization': 'You are a performance engineer. Optimize for speed, memory, and maintainability.'
    };
    return prompts[taskType] || 'You are a helpful AI assistant.';
  }

  private getStrategyForSpecialization(specialization: string): any {
    // Return context strategy tailored to agent specialization
    return {};
  }

  private async calculateSemanticSimilarity(text1: string, text2: string): Promise<number> {
    // Simple keyword overlap for now (could use embeddings)
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  private extractFileReferences(content: string): string[] {
    // Extract file paths from context
    const filePattern = /\b[\w\-\.]+\.(ts|js|tsx|jsx|py|go|rs)\b/g;
    return Array.from(content.matchAll(filePattern)).map(m => m[0]);
  }
}

export default ContextOptimizer;
