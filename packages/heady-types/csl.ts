/**
 * Confidence Signal Layer (CSL) Types
 *
 * Core types for data quality assessment, confidence signaling,
 * and conditional data gating.
 *
 * @module @heady/types
 */

/**
 * Confidence level
 */
export type ConfidenceLevel = 'critical' | 'high' | 'medium' | 'low' | 'minimal';

/**
 * Confidence signal
 */
export interface Signal {
  /**
   * Unique signal ID
   */
  id: string;

  /**
   * Associated data ID
   */
  dataId: string;

  /**
   * Confidence score (0-1)
   */
  score: number;

  /**
   * Confidence level
   */
  level: ConfidenceLevel;

  /**
   * Signal generation timestamp
   */
  timestamp: Date;

  /**
   * Data source
   */
  source?: string;

  /**
   * Signal factors
   */
  factors?: SignalFactor[];

  /**
   * Detected anomalies
   */
  anomalies?: Anomaly[];

  /**
   * Signal metadata
   */
  metadata?: {
    service?: string;
    requestId?: string;
    correlationId?: string;
    [key: string]: any;
  };
}

/**
 * Signal factor contributing to confidence score
 */
export interface SignalFactor {
  /**
   * Factor name
   * @example 'data_age', 'source_reliability', 'completeness'
   */
  name: string;

  /**
   * Factor weight in overall calculation (0-1)
   */
  weight: number;

  /**
   * Factor contribution value (0-1)
   */
  value: number;

  /**
   * Factor description
   */
  description?: string;
}

/**
 * Data age information
 */
export interface DataAge {
  /**
   * Data creation time
   */
  createdAt: Date;

  /**
   * Last update time
   */
  updatedAt: Date;

  /**
   * Age in seconds
   */
  ageSeconds: number;

  /**
   * Age level
   */
  ageLevel: 'fresh' | 'recent' | 'stale' | 'very_stale';
}

/**
 * Source reliability metrics
 */
export interface SourceReliability {
  /**
   * Source identifier
   */
  source: string;

  /**
   * Reliability score (0-1)
   */
  reliability: number;

  /**
   * Number of independent verifications
   */
  verifications: number;

  /**
   * Historical accuracy rate (0-1)
   */
  historicalAccuracy: number;

  /**
   * Last verification time
   */
  lastVerified?: Date;

  /**
   * Verification status
   */
  status: 'verified' | 'unverified' | 'failed';
}

/**
 * Data completeness metrics
 */
export interface Completeness {
  /**
   * Completeness ratio (0-1)
   */
  ratio: number;

  /**
   * Total fields
   */
  totalFields: number;

  /**
   * Filled fields
   */
  filledFields: number;

  /**
   * Missing fields
   */
  missingFields: string[];

  /**
   * Completeness level
   */
  level: 'complete' | 'mostly_complete' | 'partial' | 'incomplete';
}

/**
 * Data consistency metrics
 */
export interface Consistency {
  /**
   * Consistency score (0-1)
   */
  score: number;

  /**
   * Cross-checks performed
   */
  checksPerformed: number;

  /**
   * Checks passed
   */
  checksPassed: number;

  /**
   * Consistency issues
   */
  issues?: string[];

  /**
   * Consistency level
   */
  level: 'consistent' | 'mostly_consistent' | 'inconsistent';
}

/**
 * Detected anomaly
 */
export interface Anomaly {
  /**
   * Anomaly type
   */
  type: 'outlier' | 'missing' | 'inconsistent' | 'duplicate' | 'suspicious';

  /**
   * Anomaly severity
   */
  severity: 'low' | 'medium' | 'high' | 'critical';

  /**
   * Description
   */
  description: string;

  /**
   * Affected field/path
   */
  affectedField?: string;

  /**
   * Suggested action
   */
  suggestedAction?: 'investigate' | 'flag' | 'block' | 'none';
}

/**
 * CSL gate decision
 */
export interface Gate {
  /**
   * Unique gate ID
   */
  id: string;

  /**
   * Associated signal ID
   */
  signalId: string;

  /**
   * Gate decision
   */
  decision: 'pass' | 'caution' | 'block';

  /**
   * Confidence threshold for gate
   */
  threshold: number;

  /**
   * Associated signal
   */
  signal?: Signal;

  /**
   * Decision reasoning
   */
  reasoning?: string;

  /**
   * Suggested action
   */
  suggestedAction?: 'proceed' | 'retry' | 'escalate' | 'reject';

  /**
   * Gate evaluation timestamp
   */
  evaluatedAt: Date;
}

/**
 * CSL pipeline metrics
 */
export interface CSLMetrics {
  /**
   * Pipeline identifier
   */
  pipelineId: string;

  /**
   * Metrics period
   */
  period: {
    startTime: Date;
    endTime: Date;
  };

  /**
   * Average confidence score
   */
  averageConfidence: number;

  /**
   * Minimum confidence score
   */
  minConfidence: number;

  /**
   * Maximum confidence score
   */
  maxConfidence: number;

  /**
   * Total signals generated
   */
  signalCount: number;

  /**
   * Gate decision breakdown
   */
  gateDecisions: {
    pass: number;
    caution: number;
    block: number;
  };

  /**
   * Anomaly detection summary
   */
  anomalyCounts: {
    outlier: number;
    missing: number;
    inconsistent: number;
    duplicate: number;
    suspicious: number;
  };

  /**
   * Average data age
   */
  avgDataAge?: number;

  /**
   * Average source reliability
   */
  avgSourceReliability?: number;
}

/**
 * CSL pipeline configuration
 */
export interface CSLPipelineConfig {
  /**
   * Pipeline name
   */
  name: string;

  /**
   * Data sources
   */
  dataSources: {
    id: string;
    type: string;
    reliability: number;
  }[];

  /**
   * Gate thresholds
   */
  gateThresholds: {
    block: number;
    caution: number;
    pass: number;
  };

  /**
   * Factor weights
   */
  factorWeights: {
    dataAge: number;
    sourceReliability: number;
    completeness: number;
    consistency: number;
    anomalies: number;
  };

  /**
   * Anomaly detection enabled
   */
  anomalyDetection: {
    enabled: boolean;
    sensitivity: 'low' | 'medium' | 'high';
  };

  /**
   * Quality thresholds
   */
  qualityThresholds: {
    minCompleteness: number;
    minConsistency: number;
    maxAnomalySeverity: 'low' | 'medium' | 'high';
  };
}

/**
 * Data quality assessment
 */
export interface DataQuality {
  /**
   * Data ID
   */
  dataId: string;

  /**
   * Quality score (0-1)
   */
  score: number;

  /**
   * Quality rating
   */
  rating: 'excellent' | 'good' | 'fair' | 'poor';

  /**
   * Associated signals
   */
  signals: Signal[];

  /**
   * Quality dimensions
   */
  dimensions: {
    accuracy?: number;
    completeness?: number;
    consistency?: number;
    timeliness?: number;
    validity?: number;
  };

  /**
   * Quality issues
   */
  issues?: QualityIssue[];

  /**
   * Assessment timestamp
   */
  assessedAt: Date;

  /**
   * Assessment validity period
   */
  validUntil?: Date;
}

/**
 * Quality issue
 */
export interface QualityIssue {
  /**
   * Issue ID
   */
  id: string;

  /**
   * Issue type
   */
  type: 'accuracy' | 'completeness' | 'consistency' | 'timeliness' | 'validity';

  /**
   * Severity
   */
  severity: 'low' | 'medium' | 'high' | 'critical';

  /**
   * Issue description
   */
  description: string;

  /**
   * Affected data path
   */
  affectedPath?: string;

  /**
   * Recommended remediation
   */
  remediation?: string;

  /**
   * Issue detected time
   */
  detectedAt: Date;

  /**
   * Issue status
   */
  status: 'open' | 'investigating' | 'resolved';
}

/**
 * CSL audit log entry
 */
export interface CSLAuditEntry {
  /**
   * Entry ID
   */
  id: string;

  /**
   * Audit event type
   */
  eventType: 'signal_generated' | 'gate_decision' | 'anomaly_detected' | 'remediation_applied';

  /**
   * Related signal ID
   */
  signalId?: string;

  /**
   * Related gate ID
   */
  gateId?: string;

  /**
   * Data ID
   */
  dataId: string;

  /**
   * Action details
   */
  details: Record<string, any>;

  /**
   * Actor (service/user)
   */
  actor?: string;

  /**
   * Audit timestamp
   */
  timestamp: Date;

  /**
   * Audit level
   */
  level: 'info' | 'warning' | 'error';
}
