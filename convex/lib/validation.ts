/**
 * Input validation helpers for Convex functions
 * Convex validators handle type checking; these handle business rules
 */

import { VALIDATION_CONSTANTS } from "../../app/types/validationConstants";

/**
 * Validate metric value is non-negative
 */
export function validateMetric(value: number, fieldName: string): void {
  if (value < VALIDATION_CONSTANTS.METRIC_MIN_VALUE) {
    throw new Error(`Validation: ${fieldName} must be ${VALIDATION_CONSTANTS.METRIC_MIN_VALUE} or greater`);
  }
}

/**
 * Validate metrics object if present
 */
export function validateMetrics(
  metrics?: {
    numberOfUsers?: number;
    timesUsed?: number;
    timeSaved?: number;
    roi?: number;
  }
): void {
  if (!metrics) return;
  if (metrics.numberOfUsers !== undefined) validateMetric(metrics.numberOfUsers, "numberOfUsers");
  if (metrics.timesUsed !== undefined) validateMetric(metrics.timesUsed, "timesUsed");
  if (metrics.timeSaved !== undefined) validateMetric(metrics.timeSaved, "timeSaved");
  // roi can be negative (loss), so no validation needed
}

/**
 * Validate non-empty string
 */
export function validateNonEmptyString(value: string, fieldName: string): void {
  if (!value || value.trim().length === 0) {
    throw new Error(`Validation: ${fieldName} cannot be empty`);
  }
}

/**
 * Validate slug format: lowercase alphanumeric with hyphens, 1-100 chars
 * Pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/
 */
export function validateSlug(slug: string): void {
  validateNonEmptyString(slug, "slug");

  if (slug !== slug.toLowerCase()) {
    throw new Error("Validation: slug must be lowercase");
  }

  if (slug.length > 100) {
    throw new Error("Validation: slug must be 100 characters or less");
  }

  const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  if (!slugPattern.test(slug)) {
    throw new Error(
      "Validation: slug must contain only lowercase letters, numbers, and hyphens (no leading/trailing/consecutive hyphens)"
    );
  }
}

/**
 * Validate string with max length
 */
function validateStringLength(
  value: string,
  fieldName: string,
  maxLength: number
): void {
  validateNonEmptyString(value, fieldName);
  if (value.length > maxLength) {
    throw new Error(
      `Validation: ${fieldName} must be ${maxLength} characters or less`
    );
  }
}

/**
 * Validate canvas title (max chars from shared constants)
 */
export function validateTitle(title: string): void {
  validateStringLength(title, "title", VALIDATION_CONSTANTS.CANVAS_TITLE_MAX_LENGTH);
}

/**
 * Validate agent name (max chars from shared constants)
 */
export function validateAgentName(name: string): void {
  validateStringLength(name, "name", VALIDATION_CONSTANTS.AGENT_NAME_MAX_LENGTH);
}

/**
 * Validate phase name (max chars from shared constants)
 */
export function validatePhase(phase: string): void {
  validateStringLength(phase, "phase", VALIDATION_CONSTANTS.PHASE_MAX_LENGTH);
}

/**
 * Validate URL format (optional field)
 */
export function validateOptionalUrl(
  url: string | undefined,
  fieldName: string
): void {
  if (!url) return;
  // Allow "#" as a placeholder for missing URLs
  if (url === "#") return;
  try {
    new URL(url);
  } catch {
    throw new Error(`Validation: ${fieldName} must be a valid URL`);
  }
}

