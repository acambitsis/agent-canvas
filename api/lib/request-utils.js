/**
 * Request utility functions for API handlers
 */

/**
 * Parse JSON body from request
 * Handles both string and pre-parsed body formats
 * @param {object} req - Request object
 * @returns {{ body: object, error: string | null }}
 */
export function parseJsonBody(req) {
  try {
    if (typeof req.body === 'string') {
      return { body: JSON.parse(req.body), error: null };
    }
    return { body: req.body || {}, error: null };
  } catch (e) {
    return { body: {}, error: 'Invalid JSON body' };
  }
}
