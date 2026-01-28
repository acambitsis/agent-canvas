/**
 * Form validation utilities
 */

import { VALIDATION_CONSTANTS } from '@/types/validationConstants';

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
  objective?: string;
  description?: string;
  demoLink?: string;
  videoLink?: string;
}): ValidationError[] {
  const errors: ValidationError[] = [];

  // Name is required
  if (!data.name || data.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Agent name is required' });
  } else if (data.name.length > VALIDATION_CONSTANTS.AGENT_NAME_MAX_LENGTH) {
    errors.push({ field: 'name', message: `Agent name must be ${VALIDATION_CONSTANTS.AGENT_NAME_MAX_LENGTH} characters or less` });
  }

  // Phase is required
  if (!data.phase || data.phase.trim().length === 0) {
    errors.push({ field: 'phase', message: 'Phase is required' });
  } else if (data.phase.length > VALIDATION_CONSTANTS.PHASE_MAX_LENGTH) {
    errors.push({ field: 'phase', message: `Phase must be ${VALIDATION_CONSTANTS.PHASE_MAX_LENGTH} characters or less` });
  }

  // Validate optional field lengths
  if (data.objective && data.objective.length > VALIDATION_CONSTANTS.AGENT_OBJECTIVE_MAX_LENGTH) {
    errors.push({ field: 'objective', message: `Objective must be ${VALIDATION_CONSTANTS.AGENT_OBJECTIVE_MAX_LENGTH} characters or less` });
  }

  if (data.description && data.description.length > VALIDATION_CONSTANTS.AGENT_DESCRIPTION_MAX_LENGTH) {
    errors.push({ field: 'description', message: `Description must be ${VALIDATION_CONSTANTS.AGENT_DESCRIPTION_MAX_LENGTH} characters or less` });
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

  if (title.length > VALIDATION_CONSTANTS.CANVAS_TITLE_MAX_LENGTH) {
    errors.push({ field: 'title', message: `Canvas title must be ${VALIDATION_CONSTANTS.CANVAS_TITLE_MAX_LENGTH} characters or less` });
  }

  return errors;
}
