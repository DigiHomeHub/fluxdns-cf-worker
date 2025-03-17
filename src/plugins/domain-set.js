/**
 * Domain Set Plugin
 *
 * Manages sets of domain names for use in matchers and other plugins.
 * Supports loading domain lists from files stored in KV or other storage.
 */

import { registerPlugin } from "../core/plugin-chain.js";

// Cache for domain sets
const domainSetCache = new Map();

/**
 * Execute domain set plugin
 *
 * @param {DnsContext} ctx - DNS request context
 * @param {Object} args - Plugin arguments
 * @returns {Promise<boolean>} True if domain is in set
 */
export async function executeDomainSet(ctx, args) {
  const { files = [], domains = [], includeSubdomains = true } = args;

  try {
    const queryDomain = ctx.getQueryDomain();
    if (!queryDomain) {
      return false;
    }

    // Combine domains from args and files
    const domainSet = new Set(domains);

    // Load domains from files if provided
    if (files && files.length > 0) {
      await loadDomainsFromFiles(files, domainSet);
    }

    // Match query domain against our domain set
    let matched = false;

    // Check for exact match
    if (domainSet.has(queryDomain)) {
      matched = true;
    }
    // Check for subdomain match if enabled
    else if (includeSubdomains) {
      // Split domain into parts
      const parts = queryDomain.split(".");

      // Try matching at each level
      for (let i = 1; i < parts.length; i++) {
        const parent = parts.slice(i).join(".");
        if (domainSet.has(parent)) {
          matched = true;
          break;
        }
      }
    }

    if (matched) {
      // Tag the context
      ctx.addTag("domain_set_matched");
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error in domain set plugin:", error);
    return false;
  }
}

/**
 * Load domains from files
 *
 * @param {Array<string>} files - Array of file paths
 * @param {Set<string>} domainSet - Set to add domains to
 */
async function loadDomainsFromFiles(files, domainSet) {
  for (const file of files) {
    // Check cache first
    if (domainSetCache.has(file)) {
      const cachedDomains = domainSetCache.get(file);
      cachedDomains.forEach((domain) => domainSet.add(domain));
      continue;
    }

    try {
      // In Cloudflare Workers, we would load from KV store
      // For this example, we'll just log that we would load from the file
      console.log(`Would load domains from file: ${file}`);

      // Simulate loading from KV store
      // const domainList = await KV.get(file);
      const domainList = [];

      // Add to cache
      domainSetCache.set(file, domainList);

      // Add to set
      domainList.forEach((domain) => domainSet.add(domain));
    } catch (error) {
      console.error(`Error loading domains from file ${file}:`, error);
    }
  }
}

/**
 * Register the domain set plugin
 */
export function register() {
  registerPlugin("domain_set", executeDomainSet);
}

/**
 * Get a cached domain set by tag
 *
 * @param {string} tag - Domain set tag
 * @returns {Set<string>|null} Set of domains or null if not found
 */
export function getDomainSet(tag) {
  return domainSetCache.get(tag) || null;
}

/**
 * Add domains to a cached domain set
 *
 * @param {string} tag - Domain set tag
 * @param {Array<string>} domains - Domains to add
 * @returns {boolean} True if successful
 */
export function addToDomainSet(tag, domains) {
  if (!domains || !Array.isArray(domains)) {
    return false;
  }

  let set = domainSetCache.get(tag);
  if (!set) {
    set = new Set();
    domainSetCache.set(tag, set);
  }

  domains.forEach((domain) => set.add(domain));
  return true;
}
