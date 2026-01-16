/**
 * Form validation utilities
 */

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate agent form data
 */
export function validateAgentForm(data: {
  name: string;
  phase: string;
  demoLink?: string;
  videoLink?: string;
}): ValidationError[] {
  const errors: ValidationError[] = [];

  // Name is required
  if (!data.name || data.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Agent name is required' });
  }

  // Phase is required
  if (!data.phase || data.phase.trim().length === 0) {
    errors.push({ field: 'phase', message: 'Phase is required' });
  }

  // Validate URLs if provided
  if (data.demoLink && !isValidUrl(data.demoLink)) {
    errors.push({ field: 'demoLink', message: 'Demo link must be a valid URL' });
  }

  if (data.videoLink && !isValidUrl(data.videoLink)) {
    errors.push({ field: 'videoLink', message: 'Video link must be a valid URL' });
  }

  return errors;
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate canvas title
 */
export function validateCanvasTitle(title: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!title || title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Canvas title is required' });
  }

  if (title.length > 100) {
    errors.push({ field: 'title', message: 'Canvas title must be less than 100 characters' });
  }

  return errors;
}
