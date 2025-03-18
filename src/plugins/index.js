/**
 * Plugin Index
 *
 * Exports all FluxDNS plugins and registers them with the plugin system.
 */

// Core plugins
import * as cachePlugin from "./cache.js";
import * as forwardPlugin from "./forward.js";
import * as hostsPlugin from "./hosts.js";
import * as matcherPlugin from "./matcher.js";
import * as redirectPlugin from "./redirect.js";
import * as responseModifierPlugin from "./response-modifier.js";

// MosDNS compatibility plugins
import * as domainSetPlugin from "./domain-set.js";
import * as ipMatcherPlugin from "./ip-matcher.js";
import * as loadBalancerPlugin from "./load-balancer.js";

// Export all plugins
export * from "./cache.js";
export * from "./forward.js";
export * from "./hosts.js";
export * from "./matcher.js";
export * from "./redirect.js";
export * from "./response-modifier.js";
export * from "./domain-set.js";
export * from "./ip-matcher.js";
export * from "./load-balancer.js";

/**
 * Register all plugins with the system
 */
export function registerAllPlugins() {
  // Array of all plugins
  const plugins = [
    cachePlugin,
    forwardPlugin,
    hostsPlugin,
    matcherPlugin,
    redirectPlugin,
    responseModifierPlugin,
    domainSetPlugin,
    ipMatcherPlugin,
    loadBalancerPlugin,
  ];

  // Call register function on each plugin
  plugins.forEach((plugin) => {
    if (typeof plugin.register === "function") {
      plugin.register();
    }
  });
}
