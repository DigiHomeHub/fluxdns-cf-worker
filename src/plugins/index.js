/**
 * Plugin Index
 *
 * Exports all FluxDNS plugins and registers them with the plugin system.
 */

// Core plugins
export * from "./cache.js";
export * from "./forward.js";
export * from "./hosts.js";
export * from "./matcher.js";
export * from "./redirect.js";
export * from "./response-modifier.js";

// MosDNS compatibility plugins
export * from "./domain-set.js";
export * from "./ip-matcher.js";
export * from "./load-balancer.js";

/**
 * Register all plugins with the system
 */
export function registerAllPlugins() {
  // Import and register all plugins
  const plugins = [
    require("./cache.js"),
    require("./forward.js"),
    require("./hosts.js"),
    require("./matcher.js"),
    require("./redirect.js"),
    require("./response-modifier.js"),
    require("./domain-set.js"),
    require("./ip-matcher.js"),
    require("./load-balancer.js"),
  ];

  // Call register function on each plugin
  plugins.forEach((plugin) => {
    if (typeof plugin.register === "function") {
      plugin.register();
    }
  });
}
