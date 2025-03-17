/**
 * Data Loader
 *
 * Handles loading domain lists, IP lists, and hosts files from storage.
 * Provides caching and parsing utilities for efficient data access.
 */

// Cache for loaded data
const dataCache = {
  domains: new Map(),
  ips: new Map(),
  hosts: new Map(),
};

// Cache TTL (30 minutes by default)
const CACHE_TTL = 30 * 60 * 1000;

/**
 * Load domain list from storage
 *
 * @param {string} key - Storage key or file path
 * @param {Object} env - Environment with KV bindings
 * @returns {Promise<Set<string>>} Set of domains
 */
export async function loadDomainList(key, env) {
  // Check cache first
  const cacheEntry = dataCache.domains.get(key);
  if (cacheEntry && Date.now() < cacheEntry.expiry) {
    return cacheEntry.data;
  }

  // Load from KV storage
  try {
    let domainsText;

    // Try to load from KV
    if (env && env.DATA_KV) {
      domainsText = await env.DATA_KV.get(key);
    }

    // Parse domains
    const domains = parseDomainList(domainsText || "");

    // Cache the result
    dataCache.domains.set(key, {
      data: domains,
      expiry: Date.now() + CACHE_TTL,
    });

    return domains;
  } catch (error) {
    console.error(`Error loading domain list ${key}:`, error);
    return new Set();
  }
}

/**
 * Load IP list from storage
 *
 * @param {string} key - Storage key or file path
 * @param {Object} env - Environment with KV bindings
 * @returns {Promise<Set<string>>} Set of IPs
 */
export async function loadIPList(key, env) {
  // Check cache first
  const cacheEntry = dataCache.ips.get(key);
  if (cacheEntry && Date.now() < cacheEntry.expiry) {
    return cacheEntry.data;
  }

  // Load from KV storage
  try {
    let ipsText;

    // Try to load from KV
    if (env && env.DATA_KV) {
      ipsText = await env.DATA_KV.get(key);
    }

    // Parse IPs
    const ips = parseIPList(ipsText || "");

    // Cache the result
    dataCache.ips.set(key, {
      data: ips,
      expiry: Date.now() + CACHE_TTL,
    });

    return ips;
  } catch (error) {
    console.error(`Error loading IP list ${key}:`, error);
    return new Set();
  }
}

/**
 * Load hosts file from storage
 *
 * @param {string} key - Storage key or file path
 * @param {Object} env - Environment with KV bindings
 * @returns {Promise<Object>} Hosts mapping
 */
export async function loadHostsFile(key, env) {
  // Check cache first
  const cacheEntry = dataCache.hosts.get(key);
  if (cacheEntry && Date.now() < cacheEntry.expiry) {
    return cacheEntry.data;
  }

  // Load from KV storage
  try {
    let hostsText;

    // Try to load from KV
    if (env && env.DATA_KV) {
      hostsText = await env.DATA_KV.get(key);
    }

    // Parse hosts
    const hosts = parseHostsFile(hostsText || "");

    // Cache the result
    dataCache.hosts.set(key, {
      data: hosts,
      expiry: Date.now() + CACHE_TTL,
    });

    return hosts;
  } catch (error) {
    console.error(`Error loading hosts file ${key}:`, error);
    return {};
  }
}

/**
 * Parse a domain list file
 *
 * @param {string} text - Domain list text
 * @returns {Set<string>} Set of domains
 */
function parseDomainList(text) {
  const domains = new Set();

  const lines = text.split("\n");
  for (const line of lines) {
    // Remove comments and trim
    const trimmed = line.replace(/#.*$/, "").trim();

    // Skip empty lines
    if (!trimmed) {
      continue;
    }

    // Add to set
    domains.add(trimmed);
  }

  return domains;
}

/**
 * Parse an IP list file
 *
 * @param {string} text - IP list text
 * @returns {Set<string>} Set of IPs
 */
function parseIPList(text) {
  const ips = new Set();

  const lines = text.split("\n");
  for (const line of lines) {
    // Remove comments and trim
    const trimmed = line.replace(/#.*$/, "").trim();

    // Skip empty lines
    if (!trimmed) {
      continue;
    }

    // Add to set
    ips.add(trimmed);
  }

  return ips;
}

/**
 * Parse a hosts file
 *
 * @param {string} text - Hosts file text
 * @returns {Object} Hosts mapping
 */
function parseHostsFile(text) {
  const hosts = {};

  const lines = text.split("\n");
  for (const line of lines) {
    // Remove comments and trim
    const trimmed = line.replace(/#.*$/, "").trim();

    // Skip empty lines
    if (!trimmed) {
      continue;
    }

    // Parse line (IP followed by one or more hostnames)
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) {
      continue;
    }

    const ip = parts[0];

    // Add all hostnames for this IP
    for (let i = 1; i < parts.length; i++) {
      const hostname = parts[i].toLowerCase();
      hosts[hostname] = ip;
    }
  }

  return hosts;
}

/**
 * Clear data cache
 *
 * @param {string} type - Type of cache to clear (domains, ips, hosts, or all)
 */
export function clearCache(type = "all") {
  if (type === "all" || type === "domains") {
    dataCache.domains.clear();
  }

  if (type === "all" || type === "ips") {
    dataCache.ips.clear();
  }

  if (type === "all" || type === "hosts") {
    dataCache.hosts.clear();
  }
}

/**
 * Get cache statistics
 *
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
  return {
    domains: dataCache.domains.size,
    ips: dataCache.ips.size,
    hosts: dataCache.hosts.size,
  };
}
