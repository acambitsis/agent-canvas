import { describe, it, expect } from 'vitest';

/**
 * Test input validation functions
 * These mirror the validation logic from convex/lib/validation.ts
 */

// Replicate validation functions for testing
function validateMetric(value, fieldName) {
  if (value < 0 || value > 100) {
    throw new Error(`Validation: ${fieldName} must be between 0 and 100`);
  }
}

function validateMetrics(metrics) {
  if (!metrics) return;
  validateMetric(metrics.adoption, 'adoption');
  validateMetric(metrics.satisfaction, 'satisfaction');
}

function validateNonEmptyString(value, fieldName) {
  if (!value || value.trim().length === 0) {
    throw new Error(`Validation: ${fieldName} cannot be empty`);
  }
}

function validateSlug(slug) {
  validateNonEmptyString(slug, 'slug');

  if (slug !== slug.toLowerCase()) {
    throw new Error('Validation: slug must be lowercase');
  }

  if (slug.length > 100) {
    throw new Error('Validation: slug must be 100 characters or less');
  }

  const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  if (!slugPattern.test(slug)) {
    throw new Error(
      'Validation: slug must contain only lowercase letters, numbers, and hyphens (no leading/trailing/consecutive hyphens)'
    );
  }
}

function validateTitle(title) {
  validateNonEmptyString(title, 'title');
  if (title.length > 200) {
    throw new Error('Validation: title must be 200 characters or less');
  }
}

function validateAgentName(name) {
  validateNonEmptyString(name, 'name');
  if (name.length > 100) {
    throw new Error('Validation: agent name must be 100 characters or less');
  }
}

function validateOptionalUrl(url, fieldName) {
  if (!url) return;
  try {
    new URL(url);
  } catch {
    throw new Error(`Validation: ${fieldName} must be a valid URL`);
  }
}

describe('Input Validation', () => {
  describe('validateMetric', () => {
    it('should accept values 0-100', () => {
      expect(() => validateMetric(0, 'test')).not.toThrow();
      expect(() => validateMetric(50, 'test')).not.toThrow();
      expect(() => validateMetric(100, 'test')).not.toThrow();
    });

    it('should reject values below 0', () => {
      expect(() => validateMetric(-1, 'test')).toThrow(
        'Validation: test must be between 0 and 100'
      );
      expect(() => validateMetric(-100, 'test')).toThrow();
    });

    it('should reject values above 100', () => {
      expect(() => validateMetric(101, 'test')).toThrow(
        'Validation: test must be between 0 and 100'
      );
      expect(() => validateMetric(1000, 'test')).toThrow();
    });
  });

  describe('validateMetrics', () => {
    it('should accept valid metrics', () => {
      expect(() =>
        validateMetrics({ adoption: 50, satisfaction: 75 })
      ).not.toThrow();
    });

    it('should accept undefined/null metrics', () => {
      expect(() => validateMetrics(undefined)).not.toThrow();
      expect(() => validateMetrics(null)).not.toThrow();
    });

    it('should reject invalid adoption', () => {
      expect(() =>
        validateMetrics({ adoption: -10, satisfaction: 50 })
      ).toThrow();
    });

    it('should reject invalid satisfaction', () => {
      expect(() =>
        validateMetrics({ adoption: 50, satisfaction: 150 })
      ).toThrow();
    });
  });

  describe('validateSlug', () => {
    it('should accept valid slugs', () => {
      expect(() => validateSlug('my-canvas')).not.toThrow();
      expect(() => validateSlug('canvas123')).not.toThrow();
      expect(() => validateSlug('test-canvas-2024')).not.toThrow();
      expect(() => validateSlug('a')).not.toThrow();
    });

    it('should reject uppercase', () => {
      expect(() => validateSlug('My-Canvas')).toThrow('lowercase');
      expect(() => validateSlug('CANVAS')).toThrow('lowercase');
    });

    it('should reject empty slugs', () => {
      expect(() => validateSlug('')).toThrow('cannot be empty');
      expect(() => validateSlug('   ')).toThrow('cannot be empty');
    });

    it('should reject invalid characters', () => {
      expect(() => validateSlug('canvas_name')).toThrow(); // underscores
      expect(() => validateSlug('canvas.name')).toThrow(); // dots
      expect(() => validateSlug('canvas name')).toThrow(); // spaces
      expect(() => validateSlug('canvas@name')).toThrow(); // special chars
    });

    it('should reject leading/trailing hyphens', () => {
      expect(() => validateSlug('-canvas')).toThrow();
      expect(() => validateSlug('canvas-')).toThrow();
    });

    it('should reject consecutive hyphens', () => {
      expect(() => validateSlug('canvas--name')).toThrow();
    });

    it('should reject slugs over 100 characters', () => {
      const longSlug = 'a'.repeat(101);
      expect(() => validateSlug(longSlug)).toThrow('100 characters');
    });
  });

  describe('validateTitle', () => {
    it('should accept valid titles', () => {
      expect(() => validateTitle('My Canvas')).not.toThrow();
      expect(() => validateTitle('Test 123')).not.toThrow();
    });

    it('should reject empty titles', () => {
      expect(() => validateTitle('')).toThrow('cannot be empty');
      expect(() => validateTitle('   ')).toThrow('cannot be empty');
    });

    it('should reject titles over 200 characters', () => {
      const longTitle = 'a'.repeat(201);
      expect(() => validateTitle(longTitle)).toThrow('200 characters');
    });
  });

  describe('validateAgentName', () => {
    it('should accept valid agent names', () => {
      expect(() => validateAgentName('Sales Agent')).not.toThrow();
      expect(() => validateAgentName('Agent-1')).not.toThrow();
    });

    it('should reject empty names', () => {
      expect(() => validateAgentName('')).toThrow('cannot be empty');
      expect(() => validateAgentName('   ')).toThrow('cannot be empty');
    });

    it('should reject names over 100 characters', () => {
      const longName = 'a'.repeat(101);
      expect(() => validateAgentName(longName)).toThrow('100 characters');
    });
  });

  describe('validateOptionalUrl', () => {
    it('should accept valid URLs', () => {
      expect(() =>
        validateOptionalUrl('https://example.com', 'link')
      ).not.toThrow();
      expect(() =>
        validateOptionalUrl('http://localhost:3000', 'link')
      ).not.toThrow();
    });

    it('should accept undefined/null/empty', () => {
      expect(() => validateOptionalUrl(undefined, 'link')).not.toThrow();
      expect(() => validateOptionalUrl(null, 'link')).not.toThrow();
      expect(() => validateOptionalUrl('', 'link')).not.toThrow();
    });

    it('should reject invalid URLs', () => {
      expect(() => validateOptionalUrl('not-a-url', 'link')).toThrow(
        'must be a valid URL'
      );
      expect(() => validateOptionalUrl('just text', 'link')).toThrow();
    });
  });
});
