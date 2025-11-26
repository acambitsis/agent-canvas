import { kv } from '@vercel/kv';

const MAGIC_LINK_KEY_PREFIX = 'magiclink:';
const RATE_LIMIT_IP_PREFIX = 'ratelimit:ip:';
const RATE_LIMIT_EMAIL_PREFIX = 'ratelimit:email:';
const ALLOWLIST_KEY_PREFIX = 'allowlist:';
const ALLOWLIST_INDEX_KEY = 'allowlist:index'; // Set of all allowlisted emails

/**
 * Store a magic link token with automatic expiration
 * @param {string} token - Unique token string (32+ characters)
 * @param {Object} data - Token data including email and expiration
 * @param {number} ttlSeconds - Time-to-live in seconds
 */
export async function storeMagicLink(token, data, ttlSeconds) {
  const key = `${MAGIC_LINK_KEY_PREFIX}${token}`;

  try {
    // @vercel/kv auto-serializes JSON, so we can pass the object directly
    await kv.set(key, data, { ex: ttlSeconds });
  } catch (error) {
    console.error('[STORAGE] Failed to store token:', error.message);
    throw error;
  }
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
    if (typeof kv.eval === 'function') {
      // Lua script: atomically get and delete the key
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
    console.warn('[STORAGE] Lua script failed, using fallback:', error.message);
  }

  // Fallback: best-effort atomic operation using getdel if available
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
    // getdel not available, continue to next fallback
  }

  // Last resort: non-atomic fallback (not ideal, but prevents complete failure)
  try {
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

    // Delete after retrieval (single-use)
    await kv.del(key);
    return parsed;
  } catch (error) {
    console.error('[STORAGE] Error in token retrieval:', error.message);
    return null;
  }
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

/**
 * Add email to allowlist in KV storage
 * Uses atomic operations to prevent TOCTOU race conditions
 * @param {string} email - Email address to add
 * @param {string} addedBy - Email of admin who added it
 * @returns {Promise<boolean>} True if added, false if already exists
 */
export async function addToAllowlist(email, addedBy) {
  const normalizedEmail = email.trim().toLowerCase();
  const key = `${ALLOWLIST_KEY_PREFIX}${normalizedEmail}`;
  
  // Store email with metadata using atomic SET NX (only if not exists)
  // This prevents race conditions where two concurrent requests both see the email as missing
  const data = {
    email: normalizedEmail,
    addedAt: new Date().toISOString(),
    addedBy: addedBy.trim().toLowerCase()
  };
  
  // Try atomic set-if-not-exists operation
  try {
    // Use Lua script for atomic check-and-set + index update
    if (typeof kv.eval === 'function') {
      const indexKey = ALLOWLIST_INDEX_KEY;
      const luaScript = `
        -- Check if key already exists
        local exists = redis.call('EXISTS', KEYS[1])
        if exists == 1 then
          return {false, 'exists'}
        end
        
        -- Set the email data
        redis.call('SET', KEYS[1], ARGV[1])
        
        -- Atomically update index (read-modify-write)
        local index = redis.call('GET', KEYS[2])
        local indexArray = {}
        if index then
          indexArray = cjson.decode(index)
        end
        
        -- Add email to index if not already present
        local found = false
        for i, email in ipairs(indexArray) do
          if email == ARGV[2] then
            found = true
            break
          end
        end
        
        if not found then
          table.insert(indexArray, ARGV[2])
          redis.call('SET', KEYS[2], cjson.encode(indexArray))
        end
        
        return {true, 'added'}
      `;
      
      const result = await kv.eval(
        luaScript,
        [key, indexKey],
        [JSON.stringify(data), normalizedEmail]
      );

      // Result is [success, status] - Lua booleans become 1/0 in Redis
      return !!result[0];
    }
  } catch (error) {
    console.warn('Lua script evaluation failed, using fallback:', error);
  }
  
  // Fallback: Use SET NX if available (atomic check-and-set)
  try {
    // Try SET with NX option (only set if not exists)
    // Note: @vercel/kv may support this via options
    const setResult = await kv.set(key, data, { nx: true });
    
    if (!setResult) {
      // Key already exists (NX prevented the set)
      return false;
    }
    
    // Update index atomically using Lua script
    const indexKey = ALLOWLIST_INDEX_KEY;
    if (typeof kv.eval === 'function') {
      try {
        const luaScript = `
          local index = redis.call('GET', KEYS[1])
          local indexArray = {}
          if index then
            indexArray = cjson.decode(index)
          end
          
          local found = false
          for i, email in ipairs(indexArray) do
            if email == ARGV[1] then
              found = true
              break
            end
          end
          
          if not found then
            table.insert(indexArray, ARGV[1])
            redis.call('SET', KEYS[1], cjson.encode(indexArray))
          end
        `;
        await kv.eval(luaScript, [indexKey], [normalizedEmail]);
      } catch (error) {
        console.warn('Index update Lua script failed:', error);
        // Fallback to non-atomic update (has race condition but better than nothing)
        const index = await kv.get(indexKey) || [];
        if (!index.includes(normalizedEmail)) {
          index.push(normalizedEmail);
          await kv.set(indexKey, index);
        }
      }
    } else {
      // Non-atomic fallback
      const index = await kv.get(indexKey) || [];
      if (!index.includes(normalizedEmail)) {
        index.push(normalizedEmail);
        await kv.set(indexKey, index);
      }
    }
    
    return true;
  } catch (error) {
    // If SET NX is not available, fall back to check-then-set (has race condition)
    console.warn('SET NX not available, using non-atomic fallback:', error);
    const existing = await kv.get(key);
    if (existing) {
      return false;
    }
    
    await kv.set(key, data);
    
    // Non-atomic index update (race condition possible)
    const indexKey = ALLOWLIST_INDEX_KEY;
    const index = await kv.get(indexKey) || [];
    if (!index.includes(normalizedEmail)) {
      index.push(normalizedEmail);
      await kv.set(indexKey, index);
    }
    
    return true;
  }
}

/**
 * Remove email from allowlist in KV storage
 * Uses atomic operations to prevent TOCTOU race conditions
 * @param {string} email - Email address to remove
 * @returns {Promise<boolean>} True if removed, false if not found
 */
export async function removeFromAllowlist(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const key = `${ALLOWLIST_KEY_PREFIX}${normalizedEmail}`;
  const indexKey = ALLOWLIST_INDEX_KEY;
  
  // Use Lua script for atomic check-delete-index-update
  try {
    if (typeof kv.eval === 'function') {
      const luaScript = `
        -- Check if key exists
        local exists = redis.call('EXISTS', KEYS[1])
        if exists == 0 then
          return {false, 'not_found'}
        end
        
        -- Delete the email record
        redis.call('DEL', KEYS[1])
        
        -- Atomically update index (read-modify-write)
        local index = redis.call('GET', KEYS[2])
        if index then
          local indexArray = cjson.decode(index)
          local updatedArray = {}
          for i, email in ipairs(indexArray) do
            if email ~= ARGV[1] then
              table.insert(updatedArray, email)
            end
          end
          redis.call('SET', KEYS[2], cjson.encode(updatedArray))
        end
        
        return {true, 'removed'}
      `;
      
      const result = await kv.eval(
        luaScript,
        [key, indexKey],
        [normalizedEmail]
      );

      // Result is [success, status] - Lua booleans become 1/0 in Redis
      return !!result[0];
    }
  } catch (error) {
    console.warn('Lua script evaluation failed, using fallback:', error);
  }
  
  // Fallback: Non-atomic approach (has race condition but prevents complete failure)
  const existing = await kv.get(key);
  if (!existing) {
    return false; // Not found
  }
  
  // Delete the email record
  await kv.del(key);
  
  // Update index (non-atomic, race condition possible)
  const index = await kv.get(indexKey) || [];
  const updatedIndex = index.filter(e => e !== normalizedEmail);
  await kv.set(indexKey, updatedIndex);
  
  return true;
}

/**
 * Check if email is in KV allowlist
 * @param {string} email - Email address to check
 * @returns {Promise<boolean>} True if in allowlist
 */
export async function isInAllowlist(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const key = `${ALLOWLIST_KEY_PREFIX}${normalizedEmail}`;
  const data = await kv.get(key);
  return data !== null;
}

/**
 * List all emails in KV allowlist
 * @returns {Promise<Array<Object>>} Array of allowlist entries with metadata
 */
export async function listAllowlist() {
  const indexKey = ALLOWLIST_INDEX_KEY;
  const index = await kv.get(indexKey) || [];
  
  // Fetch all email records
  const entries = [];
  for (const email of index) {
    const key = `${ALLOWLIST_KEY_PREFIX}${email}`;
    const data = await kv.get(key);
    if (data) {
      entries.push(data);
    }
  }
  
  // Sort by added date (newest first)
  entries.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
  
  return entries;
}

