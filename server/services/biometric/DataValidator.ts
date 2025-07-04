import { BiometricDataPoint } from '../BiometricPipelineService';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

export interface ValidationConfig {
  allowFutureTimestamp: number; // milliseconds into future allowed
  heartRateRange: { min: number; max: number };
  temperatureRange: { min: number; max: number };
  percentageRange: { min: number; max: number };
  respiratoryRateRange: { min: number; max: number };
  oxygenSaturationRange: { min: number; max: number };
  strictValidation: boolean;
}

/**
 * Comprehensive data validation and sanitization for biometric data
 */
export class DataValidator {
  private config: ValidationConfig;

  constructor(config: Partial<ValidationConfig> = {}) {
    this.config = {
      allowFutureTimestamp: 60000, // 1 minute future
      heartRateRange: { min: 30, max: 250 },
      temperatureRange: { min: 15, max: 45 }, // Celsius
      percentageRange: { min: 0, max: 100 },
      respiratoryRateRange: { min: 5, max: 50 },
      oxygenSaturationRange: { min: 70, max: 100 },
      strictValidation: true,
      ...config
    };
  }

  /**
   * Comprehensive validation of biometric data
   */
  async validateInput(data: BiometricDataPoint): Promise<ValidationResult> {
    const warnings: string[] = [];

    // Required field validation
    const requiredValidation = this.validateRequiredFields(data);
    if (!requiredValidation.isValid) {
      return requiredValidation;
    }

    // Timestamp validation
    const timestampValidation = this.validateTimestamp(data.timestamp);
    if (!timestampValidation.isValid) {
      return timestampValidation;
    }

    // Physiological range validation
    const physiologicalValidation = this.validatePhysiologicalRanges(data);
    if (!physiologicalValidation.isValid) {
      return physiologicalValidation;
    }
    if (physiologicalValidation.warnings) {
      warnings.push(...physiologicalValidation.warnings);
    }

    // Data consistency validation
    const consistencyValidation = this.validateDataConsistency(data);
    if (!consistencyValidation.isValid) {
      return consistencyValidation;
    }
    if (consistencyValidation.warnings) {
      warnings.push(...consistencyValidation.warnings);
    }

    // Environmental data validation
    const environmentalValidation = this.validateEnvironmentalData(data);
    if (!environmentalValidation.isValid) {
      return environmentalValidation;
    }
    if (environmentalValidation.warnings) {
      warnings.push(...environmentalValidation.warnings);
    }

    return {
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Sanitize data by removing/correcting invalid values
   */
  sanitizeData(data: BiometricDataPoint): BiometricDataPoint {
    const sanitized = { ...data };

    // Clamp values to valid ranges
    sanitized.heartRate = this.clampValue(data.heartRate, this.config.heartRateRange.min, this.config.heartRateRange.max);
    sanitized.cognitiveLoad = this.clampValue(data.cognitiveLoad, this.config.percentageRange.min, this.config.percentageRange.max);
    sanitized.attentionLevel = this.clampValue(data.attentionLevel, this.config.percentageRange.min, this.config.percentageRange.max);
    sanitized.stressLevel = this.clampValue(data.stressLevel, this.config.percentageRange.min, this.config.percentageRange.max);
    sanitized.skinTemperature = this.clampValue(data.skinTemperature, this.config.temperatureRange.min, this.config.temperatureRange.max);

    // Optional fields
    if (sanitized.respiratoryRate !== undefined) {
      sanitized.respiratoryRate = this.clampValue(sanitized.respiratoryRate, this.config.respiratoryRateRange.min, this.config.respiratoryRateRange.max);
    }

    if (sanitized.oxygenSaturation !== undefined) {
      sanitized.oxygenSaturation = this.clampValue(sanitized.oxygenSaturation, this.config.oxygenSaturationRange.min, this.config.oxygenSaturationRange.max);
    }

    if (sanitized.environmentalSound !== undefined) {
      sanitized.environmentalSound = this.clampValue(sanitized.environmentalSound, 0, 120); // dB range
    }

    if (sanitized.lightLevel !== undefined) {
      sanitized.lightLevel = this.clampValue(sanitized.lightLevel, 0, 10000); // lux range
    }

    if (sanitized.temperature !== undefined) {
      sanitized.temperature = this.clampValue(sanitized.temperature, this.config.temperatureRange.min, this.config.temperatureRange.max);
    }

    // Clean up metadata
    if (sanitized.metadata) {
      sanitized.metadata = this.sanitizeMetadata(sanitized.metadata);
    }

    return sanitized;
  }

  /**
   * Check if data point is physiologically plausible
   */
  isPhysiologicallyPlausible(data: BiometricDataPoint): boolean {
    // Heart rate vs stress correlation check
    const highStressLowHR = data.stressLevel > 80 && data.heartRate < 60;
    const lowStressHighHR = data.stressLevel < 30 && data.heartRate > 120;
    
    if (highStressLowHR || lowStressHighHR) {
      return false;
    }

    // Cognitive load vs attention correlation check
    const highCognitiveHighAttention = data.cognitiveLoad > 90 && data.attentionLevel > 90;
    const lowCognitiveLowAttention = data.cognitiveLoad < 10 && data.attentionLevel < 10;
    
    // These combinations are less plausible but not impossible
    if (!this.config.strictValidation) {
      return true;
    }

    return !(highCognitiveHighAttention && data.stressLevel > 80);
  }

  /**
   * Validate required fields are present and correctly typed
   */
  private validateRequiredFields(data: BiometricDataPoint): ValidationResult {
    if (!data.timestamp || typeof data.timestamp !== 'number') {
      return { isValid: false, error: 'Invalid or missing timestamp' };
    }

    if (!data.userId || typeof data.userId !== 'string') {
      return { isValid: false, error: 'Invalid or missing userId' };
    }

    if (!data.sessionId || typeof data.sessionId !== 'string') {
      return { isValid: false, error: 'Invalid or missing sessionId' };
    }

    // Check required numeric fields
    const requiredNumbers = ['heartRate', 'hrv', 'skinTemperature', 'cognitiveLoad', 'attentionLevel', 'stressLevel'];
    for (const field of requiredNumbers) {
      if (data[field] === undefined || typeof data[field] !== 'number' || isNaN(data[field])) {
        return { isValid: false, error: `Invalid or missing ${field}` };
      }
    }

    return { isValid: true };
  }

  /**
   * Validate timestamp is reasonable
   */
  private validateTimestamp(timestamp: number): ValidationResult {
    const now = Date.now();
    
    if (timestamp > now + this.config.allowFutureTimestamp) {
      return { isValid: false, error: 'Timestamp too far in the future' };
    }

    // Reject timestamps older than 24 hours
    if (timestamp < now - (24 * 60 * 60 * 1000)) {
      return { isValid: false, error: 'Timestamp too old (>24 hours)' };
    }

    return { isValid: true };
  }

  /**
   * Validate physiological ranges
   */
  private validatePhysiologicalRanges(data: BiometricDataPoint): ValidationResult {
    const warnings: string[] = [];

    // Heart rate validation
    if (data.heartRate < this.config.heartRateRange.min || data.heartRate > this.config.heartRateRange.max) {
      return { isValid: false, error: 'Heart rate out of physiological range' };
    }

    // HRV validation (basic range check)
    if (data.hrv < 0 || data.hrv > 200) {
      return { isValid: false, error: 'HRV out of expected range' };
    }

    // Temperature validation
    if (data.skinTemperature < this.config.temperatureRange.min || data.skinTemperature > this.config.temperatureRange.max) {
      return { isValid: false, error: 'Skin temperature out of physiological range' };
    }

    // Percentage field validation
    const percentageFields = ['cognitiveLoad', 'attentionLevel', 'stressLevel'];
    for (const field of percentageFields) {
      const value = data[field];
      if (value < this.config.percentageRange.min || value > this.config.percentageRange.max) {
        return { isValid: false, error: `${field} must be between ${this.config.percentageRange.min}-${this.config.percentageRange.max}` };
      }
    }

    // Optional field validation
    if (data.respiratoryRate !== undefined) {
      if (data.respiratoryRate < this.config.respiratoryRateRange.min || data.respiratoryRate > this.config.respiratoryRateRange.max) {
        return { isValid: false, error: 'Respiratory rate out of physiological range' };
      }
    }

    if (data.oxygenSaturation !== undefined) {
      if (data.oxygenSaturation < this.config.oxygenSaturationRange.min || data.oxygenSaturation > this.config.oxygenSaturationRange.max) {
        return { isValid: false, error: 'Oxygen saturation out of physiological range' };
      }
    }

    // Extreme value warnings
    if (data.heartRate > 180) {
      warnings.push('Very high heart rate detected');
    }
    if (data.stressLevel > 90) {
      warnings.push('Extremely high stress level detected');
    }
    if (data.cognitiveLoad > 95) {
      warnings.push('Critical cognitive load detected');
    }

    return { isValid: true, warnings: warnings.length > 0 ? warnings : undefined };
  }

  /**
   * Validate data consistency and plausibility
   */
  private validateDataConsistency(data: BiometricDataPoint): ValidationResult {
    const warnings: string[] = [];

    // Check for physiological plausibility
    if (!this.isPhysiologicallyPlausible(data)) {
      if (this.config.strictValidation) {
        return { isValid: false, error: 'Data point is physiologically implausible' };
      } else {
        warnings.push('Data point may be physiologically implausible');
      }
    }

    // HRV vs HR consistency
    if (data.hrv > data.heartRate * 0.5) {
      warnings.push('HRV unusually high relative to heart rate');
    }

    // Stress vs attention consistency
    if (data.stressLevel > 80 && data.attentionLevel > 80) {
      warnings.push('High stress with high attention is unusual');
    }

    return { isValid: true, warnings: warnings.length > 0 ? warnings : undefined };
  }

  /**
   * Validate environmental data if present
   */
  private validateEnvironmentalData(data: BiometricDataPoint): ValidationResult {
    const warnings: string[] = [];

    if (data.environmentalSound !== undefined) {
      if (data.environmentalSound < 0 || data.environmentalSound > 120) {
        return { isValid: false, error: 'Environmental sound level out of valid range (0-120 dB)' };
      }
      if (data.environmentalSound > 100) {
        warnings.push('Very loud environment detected');
      }
    }

    if (data.lightLevel !== undefined) {
      if (data.lightLevel < 0 || data.lightLevel > 10000) {
        return { isValid: false, error: 'Light level out of valid range (0-10000 lux)' };
      }
    }

    if (data.temperature !== undefined) {
      if (data.temperature < this.config.temperatureRange.min || data.temperature > this.config.temperatureRange.max) {
        return { isValid: false, error: 'Environmental temperature out of valid range' };
      }
    }

    return { isValid: true, warnings: warnings.length > 0 ? warnings : undefined };
  }

  /**
   * Clamp value to specified range
   */
  private clampValue(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Sanitize metadata object
   */
  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    // Only keep safe metadata fields
    const allowedKeys = ['source', 'version', 'calibration', 'quality', 'notes'];
    
    for (const key of allowedKeys) {
      if (metadata[key] !== undefined) {
        // Basic sanitization - remove potentially dangerous content
        if (typeof metadata[key] === 'string') {
          sanitized[key] = metadata[key].substring(0, 1000); // Limit string length
        } else if (typeof metadata[key] === 'number') {
          sanitized[key] = metadata[key];
        } else if (typeof metadata[key] === 'boolean') {
          sanitized[key] = metadata[key];
        }
      }
    }
    
    return sanitized;
  }

  /**
   * Get validation statistics
   */
  getValidationStats(): {
    config: ValidationConfig;
    ranges: {
      heartRate: string;
      temperature: string;
      percentage: string;
    };
  } {
    return {
      config: this.config,
      ranges: {
        heartRate: `${this.config.heartRateRange.min}-${this.config.heartRateRange.max} bpm`,
        temperature: `${this.config.temperatureRange.min}-${this.config.temperatureRange.max}°C`,
        percentage: `${this.config.percentageRange.min}-${this.config.percentageRange.max}%`
      }
    };
  }
}