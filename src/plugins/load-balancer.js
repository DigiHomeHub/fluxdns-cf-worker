/**
 * Load Balancer Plugin
 *
 * Distributes DNS requests across multiple upstream DNS servers
 * supporting various load balancing strategies.
 */

import { registerPlugin } from "../core/plugin-chain.js";

/**
 * Execute load balancer plugin
 *
 * @param {DnsContext} ctx - DNS request context
 * @param {Object} args - Plugin arguments
 * @returns {Promise<boolean>} True if successful
 */
export async function executeLoadBalancer(ctx, args) {
  const {
    upstreams = [],
    strategy = "random",
    timeout = 5000,
    parallel_timeout = 2000, // Timeout for parallel queries
  } = args;

  if (!upstreams || upstreams.length === 0) {
    console.error("Load balancer plugin requires at least one upstream");
    return false;
  }

  try {
    // Get global plugins registry
    const plugins = global.plugins || {};

    // Strategy: random selection
    if (strategy === "random") {
      const randomIndex = Math.floor(Math.random() * upstreams.length);
      const selectedUpstream = upstreams[randomIndex];

      // Get the plugin function
      const plugin = plugins[selectedUpstream];

      if (!plugin) {
        console.error(`Referenced plugin not found: ${selectedUpstream}`);
        return false;
      }

      // Execute the selected plugin
      return await plugin(ctx, {});
    }

    // Strategy: parallel queries (similar to MosDNS concurrent)
    if (strategy === "parallel") {
      // Create a promise for each upstream
      const queries = upstreams.map((upstream) => {
        return new Promise(async (resolve) => {
          // Create a context clone for this query
          const queryCtx = {
            ...ctx,
            dnsMessage: ctx.dnsMessage,
            resolved: false,
            metadata: { ...ctx.metadata },
          };

          // Get the plugin function
          const plugin = plugins[upstream];

          if (!plugin) {
            console.error(`Referenced plugin not found: ${upstream}`);
            resolve({ success: false, upstream });
            return;
          }

          // Set timeout
          const timeoutId = setTimeout(() => {
            resolve({ success: false, upstream, error: "timeout" });
          }, parallel_timeout);

          try {
            // Execute the plugin
            const result = await plugin(queryCtx, {});
            clearTimeout(timeoutId);

            resolve({
              success: result && queryCtx.resolved,
              upstream,
              ctx: queryCtx,
            });
          } catch (error) {
            clearTimeout(timeoutId);
            resolve({ success: false, upstream, error });
          }
        });
      });

      // Race the promises
      const results = await Promise.all(queries);

      // Find the first successful response
      const firstSuccess = results.find((r) => r.success);

      if (firstSuccess) {
        // Copy the response from the successful context to the original context
        ctx.setResponse(firstSuccess.ctx.response);
        ctx.resolved = true;
        ctx.metadata.upstream = firstSuccess.upstream;
        return true;
      }

      // If we reach here, all upstreams failed
      return false;
    }

    // Strategy: fallback (try upstreams in order until one succeeds)
    if (strategy === "fallback") {
      for (const upstream of upstreams) {
        // Get the plugin function
        const plugin = plugins[upstream];

        if (!plugin) {
          console.error(`Referenced plugin not found: ${upstream}`);
          continue;
        }

        try {
          // Execute the plugin
          const result = await plugin(ctx, {});

          // If successful, return true
          if (result && ctx.resolved) {
            ctx.metadata.upstream = upstream;
            return true;
          }
        } catch (error) {
          console.error(`Error executing upstream ${upstream}:`, error);
          // Continue to next upstream
        }
      }

      // If we reach here, all upstreams failed
      return false;
    }

    // Unknown strategy
    console.error(`Unknown load balancing strategy: ${strategy}`);
    return false;
  } catch (error) {
    console.error("Error in load balancer plugin:", error);
    return false;
  }
}

/**
 * Register the load balancer plugin
 */
export function register() {
  registerPlugin("load_balancer", executeLoadBalancer);
}
