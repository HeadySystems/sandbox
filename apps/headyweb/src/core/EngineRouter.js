// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: src/core/EngineRouter.js                                  ║
// ║  LAYER: core                                                      ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
 * HeadyWeb Engine Router - Intelligent dual-engine management
 * Switches between Comet and Chromium based on content analysis and performance needs
 */

import { EventEmitter } from 'events';
import { CometEngine } from '../engines/CometEngine.js';
import { ChromiumEngine } from '../engines/ChromiumEngine.js';
import { AIAnalyzer } from '../ai/AIAnalyzer.js';
import { QuantumAccelerator } from '../quantum/QuantumAccelerator.js';

export class EngineRouter extends EventEmitter {
  constructor() {
    super();
    this.engines = {
      comet: null,
      chromium: null
    };
    this.currentEngine = null;
    this.aiAnalyzer = new AIAnalyzer();
    this.quantumAccelerator = new QuantumAccelerator();
    this.performanceMetrics = new Map();
    this.userPreferences = new Map();
    this.contentCache = new Map();
    
    this.initializeEngines();
  }

  async initializeEngines() {
    try {
      // Initialize Chromium Beta (stable foundation)
      this.engines.chromium = new ChromiumEngine({
        version: 'beta-latest',
        features: ['extensions', 'devtools', 'security', 'standards']
      });
      
      // Initialize Comet (experimental features)
      this.engines.comet = new CometEngine({
        version: 'beta-experimental',
        features: ['webgpu', 'quantum', 'neural', 'ai-rendering']
      });

      // Set default engine
      this.currentEngine = this.engines.chromium;
      
      this.emit('engines-initialized');
      console.log('🚀 HeadyWeb engines initialized successfully');
    } catch (error) {
      console.error('❌ Engine initialization failed:', error);
      this.emit('engine-error', error);
    }
  }

  /**
   * Intelligent engine selection based on content analysis
   */
  async selectOptimalEngine(url, contentType, performanceRequirements = {}) {
    const cacheKey = `${url}-${contentType}`;
    
    if (this.contentCache.has(cacheKey)) {
      return this.contentCache.get(cacheKey);
    }

    try {
      // AI-powered content analysis
      const contentAnalysis = await this.aiAnalyzer.analyzeContent(url, contentType);
      
      // Performance requirements evaluation
      const performanceScore = this.calculatePerformanceScore(performanceRequirements);
      
      // User preference weighting
      const userPreference = this.getUserPreference(contentType);
      
      // Engine selection algorithm
      let selectedEngine;
      
      if (this.shouldUseComet(contentAnalysis, performanceScore, userPreference)) {
        selectedEngine = this.engines.comet;
      } else {
        selectedEngine = this.engines.chromium;
      }

      // Cache decision
      this.contentCache.set(cacheKey, selectedEngine);
      
      // Log decision for learning
      this.logEngineDecision(url, contentType, selectedEngine, contentAnalysis);
      
      return selectedEngine;
    } catch (error) {
      console.error('❌ Engine selection failed:', error);
      return this.engines.chromium; // Fallback to Chromium
    }
  }

  shouldUseComet(analysis, performanceScore, userPreference) {
    const {
      hasWebGPU,
      hasWebAssembly,
      isAIHeavy,
      isQuantumReady,
      complexity
    } = analysis;

    const {
      needsQuantum,
      needsAI,
      needsExperimental,
      performanceCritical
    } = performanceScore;

    // Decision matrix for Comet engine
    const cometScore = 
      (hasWebGPU ? 25 : 0) +
      (hasWebAssembly ? 20 : 0) +
      (isAIHeavy ? 30 : 0) +
      (isQuantumReady ? 25 : 0) +
      (needsQuantum ? 40 : 0) +
      (needsAI ? 35 : 0) +
      (needsExperimental ? 30 : 0) +
      (performanceCritical ? 20 : 0) +
      (complexity > 0.7 ? 25 : 0) +
      (userPreference === 'comet' ? 50 : -20);

    return cometScore > 60; // Threshold for Comet selection
  }

  calculatePerformanceScore(requirements) {
    return {
      needsQuantum: requirements.quantum || false,
      needsAI: requirements.ai || false,
      needsExperimental: requirements.experimental || false,
      performanceCritical: requirements.critical || false
    };
  }

  getUserPreference(contentType) {
    return this.userPreferences.get(contentType) || 'auto';
  }

  async switchEngine(targetEngine, url) {
    if (this.currentEngine === targetEngine) {
      return; // Already using target engine
    }

    try {
      // Graceful engine transition
      await this.gracefulTransition(targetEngine, url);
      
      this.currentEngine = targetEngine;
      this.emit('engine-switched', { from: this.currentEngine, to: targetEngine, url });
      
      console.log(`🔄 Switched to ${targetEngine.constructor.name} for ${url}`);
    } catch (error) {
      console.error('❌ Engine switch failed:', error);
      this.emit('engine-switch-error', error);
    }
  }

  async gracefulTransition(targetEngine, url) {
    // Pre-warm target engine
    await targetEngine.preload(url);
    
    // Transfer session state
    const sessionState = await this.currentEngine.getSessionState();
    await targetEngine.restoreSessionState(sessionState);
    
    // Quantum optimization during transition
    if (targetEngine === this.engines.comet) {
      await this.quantumAccelerator.optimizeTransition(url);
    }
  }

  async navigateTo(url, options = {}) {
    const startTime = performance.now();
    
    try {
      // Select optimal engine
      const contentType = await this.detectContentType(url);
      const optimalEngine = await this.selectOptimalEngine(url, contentType, options);
      
      // Switch if necessary
      if (optimalEngine !== this.currentEngine) {
        await this.switchEngine(optimalEngine, url);
      }
      
      // Navigate using selected engine
      const result = await this.currentEngine.navigateTo(url, options);
      
      // Record performance metrics
      const loadTime = performance.now() - startTime;
      this.recordPerformanceMetrics(url, this.currentEngine, loadTime);
      
      this.emit('navigation-complete', { url, engine: this.currentEngine, loadTime });
      
      return result;
    } catch (error) {
      console.error('❌ Navigation failed:', error);
      this.emit('navigation-error', { url, error });
      throw error;
    }
  }

  async detectContentType(url) {
    // AI-powered content type detection
    return await this.aiAnalyzer.detectContentType(url);
  }

  recordPerformanceMetrics(url, engine, loadTime) {
    if (!this.performanceMetrics.has(engine.constructor.name)) {
      this.performanceMetrics.set(engine.constructor.name, []);
    }
    
    this.performanceMetrics.get(engine.constructor.name).push({
      url,
      loadTime,
      timestamp: Date.now()
    });
  }

  logEngineDecision(url, contentType, engine, analysis) {
    const logEntry = {
      url,
      contentType,
      engine: engine.constructor.name,
      analysis,
      timestamp: Date.now()
    };
    
    // Store for AI learning
    this.aiAnalyzer.logDecision(logEntry);
  }

  setUserPreference(contentType, engine) {
    this.userPreferences.set(contentType, engine);
    this.emit('preference-updated', { contentType, engine });
  }

  getPerformanceMetrics() {
    const metrics = {};
    
    for (const [engineName, data] of this.performanceMetrics) {
      const avgLoadTime = data.reduce((sum, entry) => sum + entry.loadTime, 0) / data.length;
      
      metrics[engineName] = {
        averageLoadTime: avgLoadTime,
        totalNavigations: data.length,
        recentPerformance: data.slice(-10) // Last 10 navigations
      };
    }
    
    return metrics;
  }

  async optimizePerformance() {
    // AI-driven optimization
    const optimizationSuggestions = await this.aiAnalyzer.generateOptimizations(
      this.getPerformanceMetrics()
    );
    
    // Apply quantum optimizations for Comet engine
    if (this.currentEngine === this.engines.comet) {
      await this.quantumAccelerator.applyOptimizations(optimizationSuggestions);
    }
    
    return optimizationSuggestions;
  }

  async shutdown() {
    // Graceful shutdown of both engines
    await Promise.all([
      this.engines.chromium?.shutdown(),
      this.engines.comet?.shutdown()
    ]);
    
    this.emit('shutdown-complete');
  }
}

export default EngineRouter;
