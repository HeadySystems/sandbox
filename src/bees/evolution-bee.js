'use strict';

/**
 * EvolutionBee — Controlled mutation generation and fitness-based population evolution.
 * Uses phi-scaled mutation rate, fib(6)=8 population size, fitness tournament selection.
 * © 2026-2026 HeadySystems Inc.
 */

const PHI  = 1.6180339887;
const PSI  = 0.6180339887;
const PHI2 = 2.6180339887;
const PHI3 = 4.2360679775;

// Evolution parameters — from pipeline spec
const MUTATION_RATE   = 0.0618;   // PSI / 10
const POPULATION_SIZE = 8;        // fib(6)
const MAX_MAGNITUDE   = 0.13;     // fib(7)/100
const MAX_GENERATIONS = 13;       // fib(7)
const TOURNAMENT_K    = 3;        // fib(4) — tournament selection size
const ELITE_COUNT     = 2;        // fib(3) — elites preserved per generation
const HISTORY_MAX     = 144;      // fib(12)
const HEARTBEAT_MS    = Math.round(PHI3 * 1000);    // 4236 ms
const COHERENCE_THRESHOLD = 1 - Math.pow(PSI, 2);  // ≈ 0.618

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

class EvolutionBee {
  constructor(config = {}) {
    this.id             = config.id ?? `evolution-${Date.now()}`;
    this.mutationRate    = config.mutationRate    ?? MUTATION_RATE;
    this.populationSize = config.populationSize  ?? POPULATION_SIZE;
    this.maxMagnitude   = config.maxMagnitude    ?? MAX_MAGNITUDE;
    this.maxGenerations = config.maxGenerations  ?? MAX_GENERATIONS;

    this._alive        = false;
    this._coherence    = 1.0;
    this._population   = [];
    this._generation   = 0;
    this._bestFitness  = 0;
    this._history      = [];
    this._heartbeatTimer = null;
  }

  async spawn() {
    this._alive = true;
    this._heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    await this.initialize();
    return this;
  }

  async initialize() {
    this._population   = [];
    this._generation   = 0;
    this._bestFitness  = 0;
    this._history      = [];
    this._coherence    = 1.0;
  }

  /**
   * Execute one evolution cycle.
   * @param {object} task — { genome: object, fitnessFunc?: Function, seed?: boolean }
   *   genome: the base genome (flat object of numeric parameters)
   *   fitnessFunc: optional synchronous fitness evaluator (genome) => number in [0,1]
   */
  async execute(task) {
    if (!this._alive) throw new Error('EvolutionBee not spawned');
    const { genome, fitnessFunc, seed = false } = task;
    if (!genome) throw new Error('genome required');

    // Seed initial population from genome
    if (seed || this._population.length === 0) {
      this._population = this._seedPopulation(genome);
      this._generation = 0;
    }

    // Evaluate fitness for all members
    const fitnessFn = fitnessFunc ?? this._defaultFitness.bind(this);
    this._population = this._population.map(g => ({ ...g, fitness: fitnessFn(g.params) }));

    // Evolve one generation
    const next = this._nextGeneration(this._population);
    this._population = next;
    this._generation++;

    const best = this._population.reduce((a, b) => b.fitness > a.fitness ? b : a);
    this._bestFitness = best.fitness;

    const record = {
      generation: this._generation,
      bestFitness: this._bestFitness,
      bestGenome: { ...best.params },
      populationSize: this._population.length,
      ts: Date.now(),
    };
    this._history.push(record);
    if (this._history.length > HISTORY_MAX) this._history.shift();

    this._coherence = Math.min(1.0, this._bestFitness);
    return { ...record, population: this._population, coherence: this._coherence };
  }

  _seedPopulation(genome) {
    const pop = [];
    // Elite 0: pristine genome
    pop.push({ params: { ...genome }, fitness: 0, generation: 0 });
    // Remaining: mutated from genome
    for (let i = 1; i < this.populationSize; i++) {
      pop.push({ params: this._mutate({ ...genome }), fitness: 0, generation: 0 });
    }
    return pop;
  }

  _mutate(params) {
    const keys = Object.keys(params);
    const mutated = { ...params };
    for (const k of keys) {
      if (typeof mutated[k] === 'number' && Math.random() < this.mutationRate) {
        // Gaussian-like mutation: phi-scaled noise
        const noise = (Math.random() * 2 - 1) * this.maxMagnitude * PHI;
        mutated[k] = clamp(mutated[k] + noise, 0, 1);
      }
    }
    return mutated;
  }

  _nextGeneration(population) {
    // Sort by fitness descending
    const sorted = [...population].sort((a, b) => b.fitness - a.fitness);
    const next = [];

    // Elitism: carry top ELITE_COUNT unchanged
    for (let i = 0; i < Math.min(ELITE_COUNT, sorted.length); i++) {
      next.push({ ...sorted[i], generation: this._generation + 1 });
    }

    // Fill rest via tournament selection + crossover + mutation
    while (next.length < this.populationSize) {
      const parentA = this._tournamentSelect(sorted);
      const parentB = this._tournamentSelect(sorted);
      const child   = this._crossover(parentA.params, parentB.params);
      const mutated = this._mutate(child);
      next.push({ params: mutated, fitness: 0, generation: this._generation + 1 });
    }

    return next;
  }

  _tournamentSelect(population) {
    const k = Math.min(TOURNAMENT_K, population.length);
    let best = null;
    for (let i = 0; i < k; i++) {
      const candidate = population[Math.floor(Math.random() * population.length)];
      if (!best || candidate.fitness > best.fitness) best = candidate;
    }
    return best;
  }

  _crossover(a, b) {
    // Phi-weighted blend crossover: child[k] = a[k] × ψ + b[k] × (1-ψ)
    const child = {};
    for (const k of Object.keys(a)) {
      if (typeof a[k] === 'number') {
        child[k] = a[k] * PSI + (b[k] ?? a[k]) * (1 - PSI);
      } else {
        child[k] = Math.random() < PSI ? a[k] : (b[k] ?? a[k]);
      }
    }
    return child;
  }

  /** Default fitness: sum of all numeric genome values, normalized by phi. */
  _defaultFitness(params) {
    const vals = Object.values(params).filter(v => typeof v === 'number');
    if (vals.length === 0) return PSI;
    const sum = vals.reduce((a, b) => a + b, 0);
    return clamp(sum / (vals.length * PHI), 0, 1);
  }

  heartbeat() {
    this._coherence = Math.min(1.0, this._bestFitness || this._coherence);
  }

  getHealth() {
    return {
      id: this.id,
      status: this._alive ? (this._coherence >= COHERENCE_THRESHOLD ? 'HEALTHY' : 'DEGRADED') : 'OFFLINE',
      coherence: parseFloat(this._coherence.toFixed(4)),
      generation: this._generation,
      bestFitness: parseFloat(this._bestFitness.toFixed(4)),
      populationSize: this._population.length,
      historyDepth: this._history.length,
      config: {
        mutationRate: this.mutationRate,
        populationSize: this.populationSize,
        maxMagnitude: this.maxMagnitude,
        maxGenerations: this.maxGenerations,
      },
    };
  }

  async shutdown() {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._alive = false;
    this._coherence = 0;
  }
}

module.exports = {
  EvolutionBee, MUTATION_RATE, POPULATION_SIZE, MAX_MAGNITUDE, MAX_GENERATIONS, COHERENCE_THRESHOLD,
};
