/**
 * Input validation helpers for Convex functions
 * Convex validators handle type checking; these handle business rules
 */

/**
 * Validate metric value is between 0 and 100
 */
export function validateMetric(value: number, fieldName: string): void {
  if (value < 0 || value > 100) {
    throw new Error(`Validation: ${fieldName} must be between 0 and 100`);
  }
}

/**
 * Validate metrics object if present
 */
export function validateMetrics(
  metrics?: { adoption: number; satisfaction: number }
): void {
  if (!metrics) return;
  validateMetric(metrics.adoption, "adoption");
  validateMetric(metrics.satisfaction, "satisfaction");
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
 * Validate canvas title (max 200 chars)
 */
export function validateTitle(title: string): void {
  validateStringLength(title, "title", 200);
}

/**
 * Validate agent name (max 100 chars)
 */
export function validateAgentName(name: string): void {
  validateStringLength(name, "name", 100);
}

/**
 * Validate phase name (max 50 chars)
 */
export function validatePhase(phase: string): void {
  validateStringLength(phase, "phase", 50);
}

/**
 * Validate URL format (optional field)
 */
export function validateOptionalUrl(
  url: string | undefined,
  fieldName: string
): void {
  if (!url) return;
  try {
    new URL(url);
  } catch {
    throw new Error(`Validation: ${fieldName} must be a valid URL`);
  }
}

/**
 * Validate ROI contribution value
 */
export function validateRoiContribution(
  roiContribution?: "Very High" | "High" | "Medium" | "Low"
): void {
  if (!roiContribution) return;
  const validValues = ["Very High", "High", "Medium", "Low"];
  if (!validValues.includes(roiContribution)) {
    throw new Error(
      `Validation: roiContribution must be one of: ${validValues.join(", ")}`
    );
  }
}
