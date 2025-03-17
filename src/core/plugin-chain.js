/**
 * Plugin Chain System
 *
 * Implements a flexible plugin system for DNS request processing.
 * Plugins are loaded and executed in a chain, with the ability to
 * short-circuit the chain based on conditions.
 */

import { PluginStatus } from "./types";

// Plugin registry to store available plugins
const pluginRegistry = new Map();

/**
 * Register a plugin with the system
 *
 * @param {string} type - Plugin type identifier
 * @param {Function} handler - Plugin handler function
 */
export function registerPlugin(type, handler) {
  if (typeof handler !== "function") {
    throw new Error(`Plugin handler for ${type} must be a function`);
  }
  pluginRegistry.set(type, handler);
}

/**
 * Create a plugin chain from configuration
 *
 * @param {Array} pluginsConfig - Array of plugin configurations
 * @returns {Object} Plugin chain object with execute method
 */
export function createPluginChain(pluginsConfig) {
  if (!Array.isArray(pluginsConfig)) {
    throw new Error("Plugin configuration must be an array");
  }

  // Transform config into executable plugins
  const plugins = pluginsConfig
    .map((config, index) => {
      const {
        type,
        args = {},
        tag = `plugin_${index}`,
        if_matched,
        if_not_matched,
      } = config;

      // Get plugin handler from registry
      const handler = pluginRegistry.get(type);
      if (!handler) {
        console.warn(
          `Plugin type "${type}" not found in registry, will be skipped`
        );
        return null;
      }

      return {
        execute: (ctx) => handler(ctx, args),
        type,
        tag,
        if_matched,
        if_not_matched,
      };
    })
    .filter(Boolean); // Remove null entries

  // Return the executable chain
  return {
    /**
     * Execute the plugin chain
     *
     * @param {DnsContext} ctx - DNS request context
     * @returns {Promise<DnsContext>} Updated context after chain execution
     */
    async execute(ctx) {
      // Ensure metadata structure is initialized
      if (!ctx.metadata) {
        ctx.metadata = {};
      }
      if (!ctx.metadata.timings) {
        ctx.metadata.timings = {};
      }
      if (!ctx.metadata.errors) {
        ctx.metadata.errors = [];
      }
      if (!ctx.metadata.tags) {
        ctx.metadata.tags = [];
      }

      for (const plugin of plugins) {
        // Skip plugin if conditional execution requirements aren't met
        if (plugin.if_matched && !ctx.hasTag(plugin.if_matched)) {
          continue;
        }

        if (plugin.if_not_matched && ctx.hasTag(plugin.if_not_matched)) {
          continue;
        }

        try {
          // Execute the plugin and get result
          const startTime = Date.now();
          const result = await plugin.execute(ctx);
          const executionTime = Date.now() - startTime;

          // Record execution time for metrics
          ctx.metadata.timings[plugin.tag] = executionTime;

          // Tag the context with the plugin tag if it returned true
          if (result === true) {
            ctx.addTag(plugin.tag);
          }

          // Break chain if this plugin resolved the request
          if (ctx.resolved) {
            break;
          }
        } catch (error) {
          console.error(
            `Error executing plugin ${plugin.tag} (${plugin.type}):`,
            error
          );
          // Continue with the next plugin unless explicitly configured to fail

          // Record error in context
          if (!ctx.metadata.errors) {
            ctx.metadata.errors = [];
          }
          ctx.metadata.errors.push({
            plugin: plugin.tag,
            error: error.message,
          });
        }
      }

      return ctx;
    },

    /**
     * Get all plugins in this chain
     *
     * @returns {Array} List of plugins
     */
    getPlugins() {
      return [...plugins];
    },
  };
}

/**
 * Load built-in and custom plugins
 *
 * This function dynamically imports plugins based on configuration.
 * In a real implementation, this would load plugins from files.
 *
 * @param {Object} config - Plugin configuration
 */
export async function loadPlugins(config = {}) {
  // For Cloudflare Worker environment, we directly import plugins
  // instead of dynamically loading them from files

  // Import standard plugins
  const standardPlugins = [
    "cache",
    "forward",
    "hosts",
    "matcher",
    "redirect",
    "response-modifier",
  ];

  for (const pluginName of standardPlugins) {
    try {
      // In a real implementation, this would be a dynamic import
      const plugin = await import(`../plugins/${pluginName}.js`);

      if (plugin && plugin.register) {
        plugin.register();
      }
    } catch (error) {
      console.error(`Failed to load plugin ${pluginName}:`, error);
    }
  }

  // Custom plugins would be loaded here if implemented
}
