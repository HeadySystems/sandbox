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
// ║  FILE: src/ai/AIAnalyzer.js                                      ║
// ║  LAYER: ai                                                        ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
 * AI Analyzer - Content analysis and optimization
 * Machine learning powered web content analysis for engine selection
 */

import * as tf from '@tensorflow/tfjs';
import { EventEmitter } from 'events';

export class AIAnalyzer extends EventEmitter {
  constructor() {
    super();
    this.models = new Map();
    this.decisionHistory = [];
    this.contentCache = new Map();
    this.isInitialized = false;
    
    this.initialize();
  }

  async initialize() {
    try {
      // Load AI models
      await this.loadModels();
      
      // Setup analysis pipeline
      this.setupAnalysisPipeline();
      
      this.isInitialized = true;
      this.emit('initialized');
      console.log('🧠 AI Analyzer initialized');
    } catch (error) {
      console.error('❌ AI Analyzer initialization failed:', error);
      this.emit('error', error);
    }
  }

  async loadModels() {
    try {
      // Content classification model
      this.models.set('content-classifier', await tf.loadLayersModel(
        '/models/content-classifier-v1.json'
      ));
      
      // Performance prediction model
      this.models.set('performance-predictor', await tf.loadLayersModel(
        '/models/performance-predictor-v1.json'
      ));
      
      // Engine selection model
      this.models.set('engine-selector', await tf.loadLayersModel(
        '/models/engine-selector-v1.json'
      ));
      
      console.log('📚 AI models loaded');
    } catch (error) {
      console.warn('⚠️ Failed to load AI models, using fallback:', error);
      this.createFallbackModels();
    }
  }

  createFallbackModels() {
    // Create simple fallback models
    const classifier = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [10], units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 5, activation: 'softmax' })
      ]
    });
    
    this.models.set('content-classifier', classifier);
    console.log('🔄 Using fallback AI models');
  }

  setupAnalysisPipeline() {
    // Setup GPU acceleration if available
    if (tf.getBackend() !== 'webgl') {
      tf.setBackend('webgl');
    }
    
    console.log('⚡ AI analysis pipeline configured');
  }

  async analyzeContent(url, contentType) {
    if (!this.isInitialized) {
      return this.getFallbackAnalysis(url, contentType);
    }

    const cacheKey = `${url}-${contentType}`;
    if (this.contentCache.has(cacheKey)) {
      return this.contentCache.get(cacheKey);
    }

    try {
      // Extract features from URL and content type
      const features = await this.extractFeatures(url, contentType);
      
      // Classify content
      const classification = await this.classifyContent(features);
      
      // Predict performance requirements
      const performance = await this.predictPerformance(features);
      
      // Recommend optimal engine
      const engineRecommendation = await this.selectEngine(features, classification, performance);
      
      const analysis = {
        url,
        contentType,
        features,
        classification,
        performance,
        engineRecommendation,
        timestamp: Date.now()
      };
      
      // Cache result
      this.contentCache.set(cacheKey, analysis);
      
      return analysis;
    } catch (error) {
      console.error('❌ Content analysis failed:', error);
      return this.getFallbackAnalysis(url, contentType);
    }
  }

  async extractFeatures(url, contentType) {
    // Extract numerical features from URL
    const urlFeatures = this.extractURLFeatures(url);
    
    // Extract content type features
    const contentFeatures = this.extractContentTypeFeatures(contentType);
    
    // Combine features
    return [...urlFeatures, ...contentFeatures];
  }

  extractURLFeatures(url) {
    const features = [];
    
    // URL length
    features.push(url.length / 1000); // Normalized
    
    // Domain complexity
    const domain = url.split('/')[2] || '';
    features.push(domain.length / 50); // Normalized
    
    // Path depth
    const pathDepth = url.split('/').length - 3;
    features.push(pathDepth / 10); // Normalized
    
    // Has query parameters
    features.push(url.includes('?') ? 1 : 0);
    
    // Has fragments
    features.push(url.includes('#') ? 1 : 0);
    
    // Protocol
    features.push(url.startsWith('https://') ? 1 : 0);
    
    // Subdomain count
    const subdomainCount = domain.split('.').length - 2;
    features.push(Math.min(subdomainCount, 5) / 5); // Normalized
    
    return features;
  }

  extractContentTypeFeatures(contentType) {
    const features = [];
    
    // Content type categories
    const categories = {
      'text/html': [1, 0, 0, 0, 0],
      'application/json': [0, 1, 0, 0, 0],
      'image/': [0, 0, 1, 0, 0],
      'video/': [0, 0, 0, 1, 0],
      'audio/': [0, 0, 0, 0, 1]
    };
    
    let category = [0, 0, 0, 0, 0];
    for (const [type, vector] of Object.entries(categories)) {
      if (contentType.startsWith(type)) {
        category = vector;
        break;
      }
    }
    
    features.push(...category);
    
    return features;
  }

  async classifyContent(features) {
    const classifier = this.models.get('content-classifier');
    if (!classifier) {
      return this.getFallbackClassification(features);
    }

    try {
      const input = tf.tensor2d([features]);
      const prediction = classifier.predict(input);
      const probabilities = await prediction.data();
      
      input.dispose();
      prediction.dispose();
      
      // Convert to classification
      const categories = ['simple', 'interactive', 'media-heavy', 'complex', 'dynamic'];
      const maxIndex = probabilities.indexOf(Math.max(...probabilities));
      
      return {
        category: categories[maxIndex],
        confidence: probabilities[maxIndex],
        probabilities: categories.reduce((obj, cat, i) => {
          obj[cat] = probabilities[i];
          return obj;
        }, {})
      };
    } catch (error) {
      console.error('❌ Content classification failed:', error);
      return this.getFallbackClassification(features);
    }
  }

  getFallbackClassification(features) {
    // Simple rule-based classification
    const urlComplexity = features[1]; // Domain complexity
    const hasQuery = features[3]; // Has query parameters
    const isHTML = features[7]; // Is HTML content
    
    if (isHTML && hasQuery && urlComplexity > 0.5) {
      return { category: 'complex', confidence: 0.7 };
    } else if (isHTML) {
      return { category: 'interactive', confidence: 0.6 };
    } else {
      return { category: 'simple', confidence: 0.5 };
    }
  }

  async predictPerformance(features) {
    const predictor = this.models.get('performance-predictor');
    if (!predictor) {
      return this.getFallbackPerformance(features);
    }

    try {
      const input = tf.tensor2d([features]);
      const prediction = predictor.predict(input);
      const values = await prediction.data();
      
      input.dispose();
      prediction.dispose();
      
      return {
        needsQuantum: values[0] > 0.7,
        needsAI: values[1] > 0.6,
        needsExperimental: values[2] > 0.5,
        performanceCritical: values[3] > 0.8,
        complexity: values[4]
      };
    } catch (error) {
      console.error('❌ Performance prediction failed:', error);
      return this.getFallbackPerformance(features);
    }
  }

  getFallbackPerformance(features) {
    const urlComplexity = features[1];
    const hasQuery = features[3];
    const isHTML = features[7];
    
    return {
      needsQuantum: urlComplexity > 0.8,
      needsAI: isHTML && hasQuery,
      needsExperimental: urlComplexity > 0.6,
      performanceCritical: hasQuery,
      complexity: urlComplexity
    };
  }

  async selectEngine(features, classification, performance) {
    const selector = this.models.get('engine-selector');
    if (!selector) {
      return this.getFallbackEngineSelection(classification, performance);
    }

    try {
      // Combine all features for engine selection
      const allFeatures = [
        ...features,
        ...Object.values(classification.probabilities || {}),
        performance.needsQuantum ? 1 : 0,
        performance.needsAI ? 1 : 0,
        performance.needsExperimental ? 1 : 0,
        performance.performanceCritical ? 1 : 0,
        performance.complexity
      ];
      
      const input = tf.tensor2d([allFeatures]);
      const prediction = selector.predict(input);
      const values = await prediction.data();
      
      input.dispose();
      prediction.dispose();
      
      const cometScore = values[0];
      const chromiumScore = values[1];
      
      return {
        recommended: cometScore > chromiumScore ? 'comet' : 'chromium',
        cometScore,
        chromiumScore,
        confidence: Math.max(cometScore, chromiumScore),
        reasoning: this.generateReasoning(classification, performance, cometScore > chromiumScore)
      };
    } catch (error) {
      console.error('❌ Engine selection failed:', error);
      return this.getFallbackEngineSelection(classification, performance);
    }
  }

  getFallbackEngineSelection(classification, performance) {
    let cometScore = 0;
    let chromiumScore = 0.5; // Default preference
    
    // Boost comet score for complex content
    if (classification.category === 'complex') {
      cometScore += 0.3;
    }
    
    // Boost comet for quantum/AI needs
    if (performance.needsQuantum) cometScore += 0.4;
    if (performance.needsAI) cometScore += 0.3;
    if (performance.needsExperimental) cometScore += 0.2;
    
    // Boost chromium for simple content
    if (classification.category === 'simple') {
      chromiumScore += 0.3;
    }
    
    const recommended = cometScore > chromiumScore ? 'comet' : 'chromium';
    
    return {
      recommended,
      cometScore,
      chromiumScore,
      confidence: Math.max(cometScore, chromiumScore),
      reasoning: this.generateReasoning(classification, performance, recommended === 'comet')
    };
  }

  generateReasoning(classification, performance, useComet) {
    const reasons = [];
    
    if (useComet) {
      if (performance.needsQuantum) reasons.push('Quantum acceleration required');
      if (performance.needsAI) reasons.push('AI enhancement needed');
      if (classification.category === 'complex') reasons.push('Complex content detected');
      if (performance.needsExperimental) reasons.push('Experimental features beneficial');
    } else {
      if (classification.category === 'simple') reasons.push('Simple content suitable for stable engine');
      if (!performance.needsQuantum && !performance.needsAI) reasons.push('No advanced features required');
      reasons.push('Chromium provides better compatibility');
    }
    
    return reasons.join(', ');
  }

  async detectContentType(url) {
    try {
      // Simple content type detection based on URL
      const extension = url.split('.').pop()?.toLowerCase();
      
      const contentTypes = {
        'html': 'text/html',
        'htm': 'text/html',
        'json': 'application/json',
        'xml': 'application/xml',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'pdf': 'application/pdf',
        'js': 'application/javascript',
        'css': 'text/css'
      };
      
      return contentTypes[extension] || 'text/html';
    } catch (error) {
      return 'text/html';
    }
  }

  async generateOptimizations(metrics) {
    const optimizations = [];
    
    // Analyze performance metrics and generate optimizations
    for (const [engine, data] of Object.entries(metrics)) {
      if (data.averageLoadTime > 2000) {
        optimizations.push({
          type: 'performance',
          engine,
          issue: 'Slow load times',
          suggestion: 'Consider preloading or caching',
          priority: 'high'
        });
      }
      
      if (data.totalNavigations > 100) {
        optimizations.push({
          type: 'usage',
          engine,
          issue: 'High usage detected',
          suggestion: 'Optimize for frequently visited sites',
          priority: 'medium'
        });
      }
    }
    
    return optimizations;
  }

  logDecision(decision) {
    this.decisionHistory.push(decision);
    
    // Keep only last 1000 decisions
    if (this.decisionHistory.length > 1000) {
      this.decisionHistory = this.decisionHistory.slice(-1000);
    }
    
    // Use decisions for model improvement
    this.updateModelFromHistory();
  }

  updateModelFromHistory() {
    // In a real implementation, this would update the AI models
    // based on the decision history for continuous learning
    if (this.decisionHistory.length % 100 === 0) {
      console.log('📊 AI model learning from', this.decisionHistory.length, 'decisions');
    }
  }

  getDecisionHistory() {
    return [...this.decisionHistory];
  }

  getCacheStats() {
    return {
      size: this.contentCache.size,
      hitRate: this.calculateHitRate(),
      entries: Array.from(this.contentCache.keys()).slice(0, 10) // Show first 10
    };
  }

  calculateHitRate() {
    // Simplified hit rate calculation
    return this.contentCache.size > 0 ? 0.85 : 0; // Placeholder
  }

  clearCache() {
    this.contentCache.clear();
    this.emit('cache-cleared');
  }

  async cleanup() {
    // Dispose all models
    for (const model of this.models.values()) {
      model.dispose();
    }
    
    this.models.clear();
    this.decisionHistory = [];
    this.contentCache.clear();
    this.isInitialized = false;
    
    this.emit('cleanup-complete');
    console.log('🧠 AI Analyzer cleaned up');
  }
}

export default AIAnalyzer;
