/**
 * Configuration Loader
 *
 * Handles loading and validating configurations for the DNS proxy.
 * Configurations can be loaded from environment variables or KV storage.
 */

// Default configuration
const DEFAULT_CONFIG = {
  plugins: [
    {
      tag: "default_forward",
      type: "forward",
      args: {
        upstream: "https://doh.pub/dns-query",
        timeout: 5000,
      },
    },
  ],
  logLevel: "info",
};

/**
 * Load configuration from environment variables or KV storage
 *
 * @param {Object} env - Environment object from Worker
 * @returns {Object} Loaded configuration
 */
export function loadConfig(env) {
  // If no environment provided, return default config
  if (!env) {
    console.log("No environment provided, using default configuration");
    return DEFAULT_CONFIG;
  }

  try {
    // Try to load config from KV or environment variables
    if (env.CONFIG) {
      // Direct config from environment variable (JSON string)
      try {
        return JSON.parse(env.CONFIG);
      } catch (error) {
        console.error("Failed to parse CONFIG environment variable:", error);
      }
    }

    // Try to load from KV
    if (env.KV && env.CONFIG_KEY) {
      // This would be the actual implementation using KV
      // const configJson = await env.KV.get(env.CONFIG_KEY);
      // if (configJson) {
      //   return JSON.parse(configJson);
      // }

      // For now, just log that we would try to load from KV
      console.log("Would load config from KV with key:", env.CONFIG_KEY);
    }

    // Try to load from predefined environment configurations
    if (env.CONFIG_PRESET) {
      const preset = env.CONFIG_PRESET.toLowerCase();

      const presetConfigs = {
        basic: createBasicConfig(env),
        adblock: createAdBlockConfig(env),
        split: createSplitConfig(env),
      };

      if (presetConfigs[preset]) {
        return presetConfigs[preset];
      } else {
        console.warn(`Unknown config preset: ${preset}`);
      }
    }

    // If we reach here, no valid config source was found
    console.log(
      "No valid configuration source found, using default configuration"
    );
    return DEFAULT_CONFIG;
  } catch (error) {
    console.error("Error loading configuration:", error);
    return DEFAULT_CONFIG;
  }
}

/**
 * Create a basic configuration with simple forwarding
 *
 * @param {Object} env - Environment object
 * @returns {Object} Basic configuration
 */
function createBasicConfig(env) {
  const upstream =
    env.UPSTREAM_DNS || "https://security.cloudflare-dns.com/dns-query";
  const timeout = parseInt(env.TIMEOUT || "5000", 10);

  return {
    plugins: [
      {
        tag: "cache",
        type: "cache",
        args: {
          size: parseInt(env.CACHE_SIZE || "1024", 10),
          ttl: parseInt(env.CACHE_TTL || "300", 10), // 5 minutes default
        },
      },
      {
        tag: "forward",
        type: "forward",
        args: {
          upstream,
          timeout,
        },
      },
    ],
    logLevel: env.LOG_LEVEL || "info",
  };
}

/**
 * Create a configuration with ad blocking
 *
 * @param {Object} env - Environment object
 * @returns {Object} Ad blocking configuration
 */
function createAdBlockConfig(env) {
  const upstream =
    env.UPSTREAM_DNS || "https://security.cloudflare-dns.com/dns-query";
  const timeout = parseInt(env.TIMEOUT || "5000", 10);
  const blockListUrl =
    env.BLOCKLIST_URL ||
    "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts";

  return {
    plugins: [
      {
        tag: "cache",
        type: "cache",
        args: {
          size: parseInt(env.CACHE_SIZE || "1024", 10),
          ttl: parseInt(env.CACHE_TTL || "300", 10),
        },
      },
      {
        tag: "blocklist",
        type: "matcher",
        args: {
          url: blockListUrl,
          action: "reject",
          response: "nxdomain",
        },
      },
      {
        tag: "forward",
        type: "forward",
        args: {
          upstream,
          timeout,
        },
      },
    ],
    logLevel: env.LOG_LEVEL || "info",
  };
}

/**
 * Create a split DNS configuration for different domain groups
 *
 * @param {Object} env - Environment object
 * @returns {Object} Split DNS configuration
 */
function createSplitConfig(env) {
  const defaultUpstream =
    env.DEFAULT_UPSTREAM || "https://security.cloudflare-dns.com/dns-query";
  const alternateUpstream =
    env.ALTERNATE_UPSTREAM || "https://dns.google/dns-query";
  const timeout = parseInt(env.TIMEOUT || "5000", 10);

  // Domains to route to alternate upstream (comma-separated list)
  const alternateDomains = (env.ALTERNATE_DOMAINS || "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);

  return {
    plugins: [
      {
        tag: "cache",
        type: "cache",
        args: {
          size: parseInt(env.CACHE_SIZE || "1024", 10),
          ttl: parseInt(env.CACHE_TTL || "300", 10),
        },
      },
      {
        tag: "alternate_domains",
        type: "matcher",
        args: {
          domain: alternateDomains,
          action: "accept",
        },
      },
      {
        tag: "alternate_upstream",
        type: "forward",
        args: {
          upstream: alternateUpstream,
          timeout,
        },
        if_matched: "alternate_domains",
      },
      {
        tag: "default_upstream",
        type: "forward",
        args: {
          upstream: defaultUpstream,
          timeout,
        },
      },
    ],
    logLevel: env.LOG_LEVEL || "info",
  };
}

/**
 * Validate a configuration object
 *
 * @param {Object} config - Configuration to validate
 * @returns {boolean} True if configuration is valid
 */
export function validateConfig(config) {
  if (!config || typeof config !== "object") {
    console.error("Configuration must be an object");
    return false;
  }

  if (!Array.isArray(config.plugins)) {
    console.error("Configuration must have a plugins array");
    return false;
  }

  // Check for at least one forwarding plugin
  const hasForwarder = config.plugins.some((p) => p.type === "forward");
  if (!hasForwarder) {
    console.error("Configuration must have at least one forward plugin");
    return false;
  }

  // Validate individual plugins
  for (const plugin of config.plugins) {
    if (!plugin.type) {
      console.error("Each plugin must have a type");
      return false;
    }

    // Plugin-specific validation could go here
  }

  return true;
}
