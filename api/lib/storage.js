import { kv } from '@vercel/kv';

const MAGIC_LINK_KEY_PREFIX = 'magiclink:';
const RATE_LIMIT_IP_PREFIX = 'ratelimit:ip:';
const RATE_LIMIT_EMAIL_PREFIX = 'ratelimit:email:';

/**
 * Store a magic link token with automatic expiration
 * @param {string} token - Unique token string (32+ characters)
 * @param {Object} data - Token data including email and expiration
 * @param {number} ttlSeconds - Time-to-live in seconds
 */
export async function storeMagicLink(token, data, ttlSeconds) {
  const key = `${MAGIC_LINK_KEY_PREFIX}${token}`;
  // @vercel/kv auto-serializes JSON, so we can pass the object directly
  await kv.set(key, data, { ex: ttlSeconds });
}

/**
 * Retrieve and DELETE a magic link token (single-use)
 * Uses atomic Lua script to prevent race conditions (TOCTOU)
 * @param {string} token - The token to verify
 * @returns {Promise<Object|null>} Token data if valid and not expired, null otherwise
 */
export async function verifyAndConsumeMagicLink(token) {
  const key = `${MAGIC_LINK_KEY_PREFIX}${token}`;
  
  // Use Lua script for atomic get-and-delete
  // This prevents race conditions where two requests could both read before either deletes
  try {
    // Try using eval if available (Redis-compatible)
    if (typeof kv.eval === 'function') {
      // Lua script: atomically get and delete the key
      // Returns the value if it exists, nil otherwise
      const luaScript = `
        local val = redis.call('GET', KEYS[1])
        if val then
          redis.call('DEL', KEYS[1])
          return val
        end
        return nil
      `;
      const result = await kv.eval(luaScript, [key], []);
      
      if (!result) {
        return null;
      }
      
      // @vercel/kv auto-deserializes JSON, so result is already an object
      const data = typeof result === 'string' ? JSON.parse(result) : result;
      
      // Check expiration
      if (new Date(data.expiresAt) <= new Date()) {
        return null;
      }
      
      return data;
    }
  } catch (error) {
    // If eval is not available or fails, fall back to best-effort approach
    // This is not ideal but prevents complete failure
    console.warn('Lua script evaluation failed, using fallback:', error);
  }
  
  // Fallback: best-effort atomic operation using getdel if available
  // Note: This may not be available in all Redis versions
  try {
    if (typeof kv.getdel === 'function') {
      const data = await kv.getdel(key);
      if (!data) {
        return null;
      }
      
      // @vercel/kv auto-deserializes JSON
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      
      // Check expiration
      if (new Date(parsed.expiresAt) <= new Date()) {
        return null;
      }
      
      return parsed;
    }
  } catch (error) {
    console.warn('getdel not available, using non-atomic fallback:', error);
  }
  
  // Last resort: non-atomic fallback (not ideal, but prevents complete failure)
  // This has a race condition but is better than nothing
  const data = await kv.get(key);
  
  if (!data) {
    return null;
  }

  // @vercel/kv auto-deserializes JSON, so data is already an object
  const parsed = typeof data === 'string' ? JSON.parse(data) : data;

  // Check expiration
  if (new Date(parsed.expiresAt) <= new Date()) {
    await kv.del(key);
    return null;
  }

  // Delete after retrieval (single-use) - race condition possible here
  await kv.del(key);
  return parsed;
}

/**
 * Check and increment rate limit counter using sliding window
 * Uses atomic INCR operation to prevent race conditions
 * @param {string} identifier - Unique identifier (IP address or email)
 * @param {Object} config - Rate limit configuration
 * @param {number} config.maxRequests - Maximum number of requests allowed
 * @param {number} config.windowSeconds - Time window in seconds
 * @returns {Promise<Object>} Rate limit result
 */
export async function checkRateLimit(identifier, config) {
  const { maxRequests, windowSeconds } = config;
  
  // Determine key prefix based on identifier type
  const isEmail = identifier.includes('@');
  const keyPrefix = isEmail ? RATE_LIMIT_EMAIL_PREFIX : RATE_LIMIT_IP_PREFIX;
  const key = `${keyPrefix}${identifier}`;
  
  // Use atomic INCR operation (Redis INCR is atomic)
  // This prevents race conditions where multiple requests could increment simultaneously
  try {
    if (typeof kv.incr === 'function') {
      // Atomically increment and set expiration if key doesn't exist
      // Use Lua script for true atomicity: INCR + EXPIRE if first increment
      if (typeof kv.eval === 'function') {
        const luaScript = `
          local current = redis.call('INCR', KEYS[1])
          if current == 1 then
            redis.call('EXPIRE', KEYS[1], ARGV[1])
          end
          local ttl = redis.call('TTL', KEYS[1])
          return {current, ttl}
        `;
        const result = await kv.eval(luaScript, [key], [windowSeconds.toString()]);
        const count = result[0];
        const ttl = result[1] > 0 ? result[1] : windowSeconds;
        const resetAt = Math.floor(Date.now() / 1000) + ttl;
        
        if (count > maxRequests) {
          return {
            allowed: false,
            remaining: 0,
            resetAt
          };
        }
        
        return {
          allowed: true,
          remaining: maxRequests - count,
          resetAt
        };
      }
      
      // Fallback: use INCR + separate EXPIRE (less atomic but better than get+set)
      const count = await kv.incr(key);
      
      // Set expiration only if this is the first increment (key was just created)
      if (count === 1) {
        await kv.expire(key, windowSeconds);
      }
      
      // Get TTL to calculate reset time
      const ttl = await kv.ttl(key);
      const resetAt = Math.floor(Date.now() / 1000) + (ttl > 0 ? ttl : windowSeconds);
      
      if (count > maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetAt
        };
      }
      
      return {
        allowed: true,
        remaining: maxRequests - count,
        resetAt
      };
    }
  } catch (error) {
    console.warn('Atomic rate limiting not available, using fallback:', error);
  }
  
  // Fallback: non-atomic approach (has race condition but prevents complete failure)
  const current = await kv.get(key);
  const count = current ? parseInt(current, 10) : 0;
  
  if (count >= maxRequests) {
    const ttl = await kv.ttl(key);
    const resetAt = Math.floor(Date.now() / 1000) + (ttl > 0 ? ttl : windowSeconds);
    
    return {
      allowed: false,
      remaining: 0,
      resetAt
    };
  }
  
  const newCount = count + 1;
  await kv.set(key, newCount.toString(), { ex: windowSeconds, nx: false });
  
  const ttl = await kv.ttl(key);
  const resetAt = Math.floor(Date.now() / 1000) + (ttl > 0 ? ttl : windowSeconds);
  
  return {
    allowed: true,
    remaining: maxRequests - newCount,
    resetAt
  };
}

