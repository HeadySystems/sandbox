/**
 * Schema Validation Utility
 *
 * AJV-based JSON Schema validator for HEADY platform schemas.
 * Provides runtime validation and type-safe schema validation.
 *
 * @module @heady/schemas
 */

import Ajv, { JSONSchemaType, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

/**
 * Singleton AJV instance with standard configuration
 */
let ajvInstance: Ajv | null = null;

/**
 * Get or create AJV instance
 *
 * @returns AJV validator instance
 */
function getAjv(): Ajv {
  if (!ajvInstance) {
    ajvInstance = new Ajv({
      allErrors: true,
      strict: true,
      strictSchema: true,
      validateSchema: true,
      useDefaults: true,
      coerceTypes: false,
    });
    addFormats(ajvInstance);
  }
  return ajvInstance;
}

/**
 * Validation error details
 */
export interface ValidationError {
  path: string;
  message: string;
  keyword: string;
  params?: Record<string, any>;
}

/**
 * Validation result
 */
export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors?: ValidationError[];
}

/**
 * Compile and cache schema validator
 */
const validatorCache = new Map<string, ValidateFunction>();

/**
 * Compile a schema into a validator function
 *
 * @param schemaId - Schema identifier
 * @param schema - JSON Schema object
 * @returns Compiled validator function
 */
export function compileSchema(schemaId: string, schema: any): ValidateFunction {
  if (validatorCache.has(schemaId)) {
    return validatorCache.get(schemaId)!;
  }

  const ajv = getAjv();
  const validator = ajv.compile(schema);
  validatorCache.set(schemaId, validator);
  return validator;
}

/**
 * Validate data against a schema
 *
 * @template T - Expected data type
 * @param data - Data to validate
 * @param schemaId - Schema identifier
 * @param schema - JSON Schema object
 * @returns Validation result with typed data
 *
 * @example
 * ```typescript
 * const result = validateSchema(userData, 'auth-session', sessionSchema);
 * if (result.valid) {
 *   console.log(result.data); // Typed as Session
 * } else {
 *   console.error(result.errors);
 * }
 * ```
 */
export function validateSchema<T>(
  data: unknown,
  schemaId: string,
  schema: any
): ValidationResult<T> {
  try {
    const validator = compileSchema(schemaId, schema);
    const valid = validator(data);

    if (valid) {
      return {
        valid: true,
        data: data as T,
      };
    }

    const errors = formatValidationErrors(validator.errors || []);
    return {
      valid: false,
      errors,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [{
        path: '$',
        message: error instanceof Error ? error.message : 'Unknown validation error',
        keyword: 'error',
      }],
    };
  }
}

/**
 * Format AJV validation errors into user-friendly format
 *
 * @param ajvErrors - AJV error objects
 * @returns Formatted validation errors
 */
function formatValidationErrors(ajvErrors: any[]): ValidationError[] {
  return ajvErrors.map((error) => ({
    path: error.instancePath || '$',
    message: buildErrorMessage(error),
    keyword: error.keyword,
    params: error.params,
  }));
}

/**
 * Build a human-readable error message from AJV error
 *
 * @param error - AJV error object
 * @returns Error message
 */
function buildErrorMessage(error: any): string {
  const path = error.instancePath || '$';

  switch (error.keyword) {
    case 'type':
      return `${path} must be of type ${error.params.type}`;
    case 'required':
      return `${path} missing required property: ${error.params.missingProperty}`;
    case 'pattern':
      return `${path} must match pattern ${error.params.pattern}`;
    case 'minLength':
      return `${path} must be at least ${error.params.minLength} characters`;
    case 'maxLength':
      return `${path} must be at most ${error.params.maxLength} characters`;
    case 'minimum':
      return `${path} must be >= ${error.params.limit}`;
    case 'maximum':
      return `${path} must be <= ${error.params.limit}`;
    case 'enum':
      return `${path} must be one of: ${error.params.allowedValues.join(', ')}`;
    case 'format':
      return `${path} must be a valid ${error.params.format}`;
    case 'additionalProperties':
      return `${path} has unexpected property: ${error.params.additionalProperty}`;
    case 'const':
      return `${path} must equal ${error.params.allowedValue}`;
    default:
      return error.message || `Validation failed at ${path}`;
  }
}

/**
 * Validate request/response payload
 *
 * @template T - Expected payload type
 * @param payload - Payload to validate
 * @param schemaId - Schema identifier
 * @param schema - JSON Schema
 * @throws ValidationError if validation fails
 * @returns Validated payload
 */
export function validateOrThrow<T>(
  payload: unknown,
  schemaId: string,
  schema: any
): T {
  const result = validateSchema<T>(payload, schemaId, schema);

  if (!result.valid) {
    const errorMsg = result.errors
      ?.map(e => `${e.path}: ${e.message}`)
      .join('; ') || 'Validation failed';

    const error = new Error(`Schema validation failed: ${errorMsg}`);
    (error as any).code = 'HEADY_VALIDATION_ERROR';
    (error as any).details = { errors: result.errors };
    throw error;
  }

  return result.data!;
}

/**
 * Batch validate multiple items
 *
 * @template T - Expected item type
 * @param items - Items to validate
 * @param schemaId - Schema identifier
 * @param schema - JSON Schema
 * @returns Array of validation results
 */
export function validateBatch<T>(
  items: unknown[],
  schemaId: string,
  schema: any
): ValidationResult<T>[] {
  return items.map(item => validateSchema<T>(item, schemaId, schema));
}

/**
 * Check if any validation errors exist in batch
 *
 * @param results - Batch validation results
 * @returns True if any results are invalid
 */
export function hasBatchErrors(results: ValidationResult<any>[]): boolean {
  return results.some(r => !r.valid);
}

/**
 * Get first error from batch results
 *
 * @param results - Batch validation results
 * @returns First validation error or undefined
 */
export function getFirstBatchError(results: ValidationResult<any>[]): ValidationError | undefined {
  for (const result of results) {
    if (!result.valid && result.errors?.[0]) {
      return result.errors[0];
    }
  }
  return undefined;
}

/**
 * Clear validator cache
 */
export function clearValidatorCache(): void {
  validatorCache.clear();
}

/**
 * Get cache statistics
 *
 * @returns Cache statistics
 */
export function getCacheStats(): { size: number; schemaIds: string[] } {
  return {
    size: validatorCache.size,
    schemaIds: Array.from(validatorCache.keys()),
  };
}
