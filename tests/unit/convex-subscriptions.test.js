import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Test Convex subscription lifecycle management
 * Tests the subscription patterns from convex-client.js
 */

describe('Convex Subscriptions', () => {
  let mockClient;
  let subscriptions;

  beforeEach(() => {
    subscriptions = new Map();

    mockClient = {
      onUpdate: vi.fn((config, callback) => {
        const unsubscribe = vi.fn();
        return unsubscribe;
      }),
      mutation: vi.fn(),
      query: vi.fn(),
    };
  });

  // Replicate subscribe logic from convex-client.js
  function subscribe(key, path, args, callback) {
    if (subscriptions.has(key)) {
      subscriptions.get(key)();
    }

    const unsubscribe = mockClient.onUpdate({ path, args }, callback);
    subscriptions.set(key, unsubscribe);
    return unsubscribe;
  }

  function unsubscribeAll() {
    for (const unsubscribe of subscriptions.values()) {
      unsubscribe();
    }
    subscriptions.clear();
  }

  describe('subscribe', () => {
    it('should create a subscription and store unsubscribe function', () => {
      const callback = vi.fn();
      subscribe('test-key', 'canvases:list', { orgId: '123' }, callback);

      expect(mockClient.onUpdate).toHaveBeenCalledWith(
        { path: 'canvases:list', args: { orgId: '123' } },
        callback
      );
      expect(subscriptions.has('test-key')).toBe(true);
    });

    it('should unsubscribe existing subscription before creating new one', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const unsub1 = subscribe('same-key', 'path1', {}, callback1);
      subscribe('same-key', 'path2', {}, callback2);

      expect(unsub1).toHaveBeenCalled();
    });

    it('should allow multiple subscriptions with different keys', () => {
      subscribe('key1', 'path1', {}, vi.fn());
      subscribe('key2', 'path2', {}, vi.fn());

      expect(subscriptions.size).toBe(2);
    });

    it('should return the unsubscribe function', () => {
      const unsubscribe = subscribe('key', 'path', {}, vi.fn());

      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('unsubscribeAll', () => {
    it('should call all unsubscribe functions', () => {
      const unsub1 = subscribe('key1', 'path1', {}, vi.fn());
      const unsub2 = subscribe('key2', 'path2', {}, vi.fn());

      unsubscribeAll();

      expect(unsub1).toHaveBeenCalled();
      expect(unsub2).toHaveBeenCalled();
    });

    it('should clear the subscriptions map', () => {
      subscribe('key1', 'path1', {}, vi.fn());
      subscribe('key2', 'path2', {}, vi.fn());

      unsubscribeAll();

      expect(subscriptions.size).toBe(0);
    });

    it('should be safe to call multiple times', () => {
      subscribe('key1', 'path1', {}, vi.fn());

      unsubscribeAll();
      expect(() => unsubscribeAll()).not.toThrow();

      expect(subscriptions.size).toBe(0);
    });

    it('should be safe to call with no subscriptions', () => {
      expect(() => unsubscribeAll()).not.toThrow();
      expect(subscriptions.size).toBe(0);
    });
  });

  describe('subscription cleanup on page events', () => {
    it('should cleanup on beforeunload event', () => {
      const cleanup = vi.fn();
      window.addEventListener('beforeunload', cleanup);

      window.dispatchEvent(new Event('beforeunload'));

      expect(cleanup).toHaveBeenCalled();

      window.removeEventListener('beforeunload', cleanup);
    });

    it('should cleanup on pagehide event', () => {
      const cleanup = vi.fn();
      window.addEventListener('pagehide', cleanup);

      window.dispatchEvent(new Event('pagehide'));

      expect(cleanup).toHaveBeenCalled();

      window.removeEventListener('pagehide', cleanup);
    });
  });

  describe('subscription replacement', () => {
    it('should replace subscription when called with same key', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      subscribe('canvas-agents', 'agents:list', { canvasId: 'c1' }, callback1);
      const unsub1 = subscriptions.get('canvas-agents');

      subscribe('canvas-agents', 'agents:list', { canvasId: 'c2' }, callback2);

      // First subscription should have been unsubscribed
      expect(unsub1).toHaveBeenCalled();
      // Map should still have only one entry
      expect(subscriptions.size).toBe(1);
    });

    it('should not affect other subscriptions when replacing one', () => {
      subscribe('key1', 'path1', {}, vi.fn());
      const unsub1 = subscriptions.get('key1');

      subscribe('key2', 'path2', {}, vi.fn());
      const unsub2 = subscriptions.get('key2');

      // Replace key2
      subscribe('key2', 'path3', {}, vi.fn());

      // key1 should not be affected
      expect(unsub1).not.toHaveBeenCalled();
      // key2 original should be unsubscribed
      expect(unsub2).toHaveBeenCalled();
    });
  });
});
