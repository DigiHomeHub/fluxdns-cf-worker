/**
 * Cache Plugin
 *
 * Caches DNS responses to improve performance and reduce load.
 */

import { registerPlugin } from "../core/plugin-chain.js";

/**
 * Execute cache plugin
 *
 * @param {DnsContext} ctx - DNS request context
 * @param {Object} args - Plugin arguments
 * @returns {Promise<boolean>} True if cache hit, false if cache miss
 */
export async function executeCache(ctx, args) {
  const domain = ctx.getQueryDomain();
  const type = ctx.getQueryType();

  if (!domain || !type) {
    return false;
  }

  // Check bypass conditions
  if (ctx.hasTag("bypass_cache")) {
    ctx.addTag("cache_bypassed");
    return false;
  }

  // TTL settings
  const ttl = args.ttl || 300; // Default 5 minutes

  // Generate cache key
  const cacheKey = `dns-${domain}-${type}`;

  try {
    // Check cache for existing response
    const cacheResponse = await caches.default.match(cacheKey);

    if (cacheResponse) {
      // Cache hit
      const responseBuffer = await cacheResponse.arrayBuffer();

      // Set response from cache
      ctx.setResponse(responseBuffer);
      ctx.addTag("cache_hit");
      ctx.resolved = true;

      return true;
    }

    // Cache miss - store key for later
    ctx.metadata.cacheKey = cacheKey;
    ctx.metadata.cacheTtl = ttl;
    ctx.addTag("cache_miss");

    // Register post-processing hook
    const originalSetResponse = ctx.setResponse;

    ctx.setResponse = function (responseBuffer) {
      // Call original method
      originalSetResponse.call(ctx, responseBuffer);

      // Cache the response
      if (ctx.metadata.cacheKey && responseBuffer) {
        const response = new Response(responseBuffer, {
          headers: {
            "Content-Type": "application/dns-message",
            "Cache-Control": `max-age=${ctx.metadata.cacheTtl}`,
          },
        });

        // Store in cache
        caches.default.put(ctx.metadata.cacheKey, response);
      }
    };

    return false;
  } catch (error) {
    console.error("Error in cache plugin:", error);
    return false;
  }
}

/**
 * Register the cache plugin
 */
export function register() {
  registerPlugin("cache", executeCache);
}
