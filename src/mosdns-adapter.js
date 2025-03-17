/**
 * MosDNS Adapter for FluxDNS
 *
 * This adapter converts MosDNS-style YAML configurations to FluxDNS plugin chain configurations.
 * It supports many of the core features of MosDNS while adapting them to the Cloudflare Workers
 * environment and FluxDNS plugin system.
 */

import { createPluginChain } from "./core/plugin-chain.js";

/**
 * Convert MosDNS configuration to FluxDNS plugin chain
 *
 * @param {Object} mosdnsConfig - MosDNS configuration object
 * @returns {Object} FluxDNS configuration
 */
export function convertMosDNSConfig(mosdnsConfig) {
  // Initialize FluxDNS configuration
  const fluxConfig = {
    plugins: [],
    logLevel: mosdnsConfig.log?.level || "info",
  };

  // Process plugins section
  if (Array.isArray(mosdnsConfig.plugins)) {
    // First pass: process domain_set and ip_set plugins
    const domainSets = {};
    const ipSets = {};

    mosdnsConfig.plugins.forEach((plugin) => {
      if (plugin.type === "domain_set" && plugin.tag) {
        domainSets[plugin.tag] = plugin;
      } else if (plugin.type === "ip_set" && plugin.tag) {
        ipSets[plugin.tag] = plugin;
      }
    });

    // Second pass: convert other plugins
    mosdnsConfig.plugins.forEach((plugin) => {
      // Skip domain_set and ip_set plugins as they're handled differently
      if (plugin.type === "domain_set" || plugin.type === "ip_set") {
        return;
      }

      const convertedPlugin = convertPlugin(plugin, { domainSets, ipSets });
      if (convertedPlugin) {
        if (Array.isArray(convertedPlugin)) {
          fluxConfig.plugins.push(...convertedPlugin);
        } else {
          fluxConfig.plugins.push(convertedPlugin);
        }
      }
    });
  }

  return fluxConfig;
}

/**
 * Convert a single MosDNS plugin to FluxDNS plugin(s)
 *
 * @param {Object} mosdnsPlugin - MosDNS plugin configuration
 * @param {Object} context - Conversion context with domain and IP sets
 * @returns {Object|Array|null} FluxDNS plugin configuration or array of plugins
 */
function convertPlugin(mosdnsPlugin, context) {
  const { domainSets, ipSets } = context;

  switch (mosdnsPlugin.type) {
    case "cache":
      return convertCachePlugin(mosdnsPlugin);

    case "hosts":
      return convertHostsPlugin(mosdnsPlugin);

    case "forward":
      return convertForwardPlugin(mosdnsPlugin);

    case "sequence":
      return convertSequencePlugin(mosdnsPlugin, context);

    case "udp_server":
    case "tcp_server":
      // Server plugins are not needed in Cloudflare Workers
      return null;

    default:
      console.warn(`Unsupported plugin type: ${mosdnsPlugin.type}`);
      return null;
  }
}

/**
 * Convert MosDNS cache plugin to FluxDNS cache plugin
 *
 * @param {Object} mosdnsPlugin - MosDNS cache plugin
 * @returns {Object} FluxDNS cache plugin
 */
function convertCachePlugin(mosdnsPlugin) {
  return {
    tag: mosdnsPlugin.tag || "cache",
    type: "cache",
    args: {
      size: mosdnsPlugin.args?.size || 1024,
      ttl: mosdnsPlugin.args?.lazy_cache_ttl || 300,
    },
  };
}

/**
 * Convert MosDNS hosts plugin to FluxDNS hosts plugin
 *
 * @param {Object} mosdnsPlugin - MosDNS hosts plugin
 * @returns {Object} FluxDNS hosts plugin
 */
function convertHostsPlugin(mosdnsPlugin) {
  return {
    tag: mosdnsPlugin.tag || "hosts",
    type: "hosts",
    args: {
      files: mosdnsPlugin.args?.files,
      ttl: 3600,
    },
  };
}

/**
 * Convert MosDNS forward plugin to FluxDNS forward plugin
 *
 * @param {Object} mosdnsPlugin - MosDNS forward plugin
 * @returns {Object} FluxDNS forward plugin
 */
function convertForwardPlugin(mosdnsPlugin) {
  const upstreams = mosdnsPlugin.args?.upstreams || [];

  // If no upstreams provided, use CloudFlare DNS as fallback
  if (upstreams.length === 0) {
    return {
      tag: mosdnsPlugin.tag || "forward",
      type: "forward",
      args: {
        upstream: "https://cloudflare-dns.com/dns-query",
        timeout: 5000,
      },
    };
  }

  // If only one upstream, create a single forwarder
  if (upstreams.length === 1) {
    const upstream = upstreams[0];
    let upstreamUrl = upstream.addr;

    // Convert DoT to DoH as Workers don't support DoT directly
    if (upstreamUrl.startsWith("tls://")) {
      const host = upstreamUrl.replace("tls://", "");
      upstreamUrl = `https://${host}/dns-query`;
    }

    return {
      tag: mosdnsPlugin.tag || "forward",
      type: "forward",
      args: {
        upstream: upstreamUrl,
        timeout: 5000,
      },
    };
  }

  // For multiple upstreams, create load balancing config
  const forwarders = upstreams.map((upstream, index) => {
    let upstreamUrl = upstream.addr;

    // Convert DoT to DoH
    if (upstreamUrl.startsWith("tls://")) {
      const host = upstreamUrl.replace("tls://", "");
      upstreamUrl = `https://${host}/dns-query`;
    }

    return {
      tag: `${mosdnsPlugin.tag || "forward"}_${index}`,
      type: "forward",
      args: {
        upstream: upstreamUrl,
        timeout: 5000,
      },
    };
  });

  // Add a load balancer plugin that rotates between forwarders
  forwarders.push({
    tag: mosdnsPlugin.tag || "forward",
    type: "load_balancer",
    args: {
      upstreams: forwarders.map((f) => f.tag),
      strategy: mosdnsPlugin.args?.concurrent ? "parallel" : "random",
    },
  });

  return forwarders;
}

/**
 * Convert MosDNS sequence plugin to FluxDNS plugins
 *
 * @param {Object} mosdnsPlugin - MosDNS sequence plugin
 * @param {Object} context - Conversion context
 * @returns {Array} Array of FluxDNS plugins
 */
function convertSequencePlugin(mosdnsPlugin, context) {
  const { domainSets, ipSets } = context;
  const plugins = [];

  // Process sequence steps
  if (Array.isArray(mosdnsPlugin.args)) {
    mosdnsPlugin.args.forEach((step, index) => {
      // Handle match conditions
      if (step.matches) {
        let matchConditions = Array.isArray(step.matches)
          ? step.matches
          : [step.matches];

        matchConditions.forEach((condition) => {
          if (typeof condition === "string") {
            // Parse condition string
            if (condition.startsWith("qname ")) {
              const domainSetRef = condition.substring(6).trim();
              if (
                domainSetRef.startsWith("$") &&
                domainSets[domainSetRef.substring(1)]
              ) {
                // Reference to a domain set
                const domainSet = domainSets[domainSetRef.substring(1)];

                plugins.push({
                  tag: `${mosdnsPlugin.tag}_match_${index}`,
                  type: "matcher",
                  args: {
                    files: domainSet.args?.files,
                    action: "accept",
                  },
                });
              }
            } else if (condition.startsWith("!resp_ip ")) {
              // Inverse IP match (not implemented in this example)
              console.warn("Inverse IP matching not fully implemented");
            } else if (condition.startsWith("resp_ip ")) {
              const ipSetRef = condition.substring(8).trim();
              if (ipSetRef.startsWith("$") && ipSets[ipSetRef.substring(1)]) {
                // Reference to an IP set
                const ipSet = ipSets[ipSetRef.substring(1)];

                plugins.push({
                  tag: `${mosdnsPlugin.tag}_ip_match_${index}`,
                  type: "ip_matcher",
                  args: {
                    files: ipSet.args?.files,
                    action: "accept",
                  },
                });
              }
            }
          }
        });
      }

      // Handle execution steps
      if (step.exec) {
        if (typeof step.exec === "string") {
          if (step.exec.startsWith("$")) {
            // Reference to another plugin
            const pluginRef = step.exec.substring(1);

            plugins.push({
              tag: `${mosdnsPlugin.tag}_exec_${index}`,
              type: "reference",
              reference: pluginRef,
              if_matched:
                plugins.length > 0
                  ? plugins[plugins.length - 1].tag
                  : undefined,
            });
          } else if (step.exec === "accept") {
            // Accept action
            plugins.push({
              tag: `${mosdnsPlugin.tag}_accept_${index}`,
              type: "response_modifier",
              args: {
                action: "accept",
              },
              if_matched:
                plugins.length > 0
                  ? plugins[plugins.length - 1].tag
                  : undefined,
            });
          } else if (step.exec === "reject") {
            // Reject action
            plugins.push({
              tag: `${mosdnsPlugin.tag}_reject_${index}`,
              type: "response_modifier",
              args: {
                action: "reject",
                rcode: "NXDOMAIN",
              },
              if_matched:
                plugins.length > 0
                  ? plugins[plugins.length - 1].tag
                  : undefined,
            });
          } else if (step.exec.startsWith("ttl ")) {
            // TTL modification
            const ttlValue = step.exec.substring(4).trim();
            let minTtl = 60,
              maxTtl = 86400;

            if (ttlValue.includes("-")) {
              const [min, max] = ttlValue
                .split("-")
                .map((v) => parseInt(v, 10));
              minTtl = min;
              maxTtl = max;
            } else {
              minTtl = maxTtl = parseInt(ttlValue, 10);
            }

            plugins.push({
              tag: `${mosdnsPlugin.tag}_ttl_${index}`,
              type: "response_modifier",
              args: {
                minTtl,
                maxTtl,
              },
              if_matched:
                plugins.length > 0
                  ? plugins[plugins.length - 1].tag
                  : undefined,
            });
          }
        }
      }
    });
  }

  return plugins;
}

/**
 * Create a FluxDNS plugin chain from MosDNS configuration
 *
 * @param {Object} mosdnsConfig - MosDNS configuration
 * @returns {Object} FluxDNS plugin chain
 */
export function createPluginChainFromMosDNS(mosdnsConfig) {
  const fluxConfig = convertMosDNSConfig(mosdnsConfig);
  return createPluginChain(fluxConfig.plugins);
}

// Default domains, IPs, and hosts data loaders
export const domainSetLoader = {
  loadDomains: async (files) => {
    // In a real implementation, this would load domain files from KV storage
    // or other Cloudflare Workers storage options
    console.log("Would load domains from", files);
    return [];
  },
};

export const ipSetLoader = {
  loadIPs: async (files) => {
    // In a real implementation, this would load IP files from KV storage
    console.log("Would load IPs from", files);
    return [];
  },
};

export const hostsLoader = {
  loadHosts: async (files) => {
    // In a real implementation, this would load hosts files from KV storage
    console.log("Would load hosts from", files);
    return {};
  },
};
