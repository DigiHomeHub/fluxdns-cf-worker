/**
 * Example configuration for FluxDNS
 *
 * This file demonstrates how to configure the plugin chain for different use cases.
 */

import { registerPlugin, createPluginChain } from "../src/core/plugin-chain";
import { executeMatcher } from "../src/plugins/matcher";
import { executeForward } from "../src/plugins/forward";
import { executeCache } from "../src/plugins/cache";

// Register plugins
registerPlugin("matcher", executeMatcher);
registerPlugin("forward", executeForward);
registerPlugin("cache", executeCache);

/**
 * Example 1: Simple forwarding to Cloudflare DNS
 */
export const simpleForwardingChain = createPluginChain([
  {
    name: "forward",
    args: {
      upstream: "https://cloudflare-dns.com/dns-query",
      timeout: 5000,
    },
  },
]);

/**
 * Example 2: Ad blocking configuration
 */
export const adBlockingChain = createPluginChain([
  {
    name: "matcher",
    args: {
      domains: [
        "ads.example.com",
        "tracker.example.com",
        "analytics.example.com",
        "ads.*",
        "*.doubleclick.net",
        "*.googlesyndication.com",
      ],
      action: "reject",
      tags: ["ad_blocked"],
    },
  },
  {
    name: "forward",
    args: {
      upstream: "https://cloudflare-dns.com/dns-query",
      timeout: 5000,
    },
  },
]);

/**
 * Example 3: Conditional forwarding based on domain patterns
 */
export const conditionalForwardingChain = createPluginChain([
  // Private domains to internal DNS server
  {
    name: "matcher",
    args: {
      domains: ["*.local", "*.internal", "corp.example.com"],
      action: "accept",
      tags: ["private_domain"],
    },
  },
  {
    name: "forward",
    when: "private_domain",
    args: {
      upstream: "https://internal-dns.example.com/dns-query",
      timeout: 3000,
    },
  },

  // Security-focused domains to security DNS provider
  {
    name: "matcher",
    args: {
      domains: ["*.bank.com", "*.finance.com", "secure.example.com"],
      action: "accept",
      tags: ["security_domain"],
    },
  },
  {
    name: "forward",
    when: "security_domain",
    args: {
      upstream: "https://security.cloudflare-dns.com/dns-query",
      timeout: 4000,
    },
  },

  // Default forwarding for all other domains
  {
    name: "forward",
    args: {
      upstream: "https://cloudflare-dns.com/dns-query",
      timeout: 5000,
    },
  },
]);

/**
 * Example 4: Caching configuration
 */
export const cachingChain = createPluginChain([
  {
    name: "cache",
    args: {
      ttl: 300, // 5 minutes
      maxSize: 1000, // Maximum number of entries
    },
  },
  {
    name: "forward",
    args: {
      upstream: "https://cloudflare-dns.com/dns-query",
      timeout: 5000,
    },
  },
]);

// Export the default chain to use
export default adBlockingChain;
