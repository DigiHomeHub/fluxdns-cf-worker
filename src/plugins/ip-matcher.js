/**
 * IP Matcher Plugin
 *
 * Matches IP addresses in DNS responses against IP sets,
 * supporting allow/deny lists and conditional forwarding based on IP.
 */

import { registerPlugin } from "../core/plugin-chain.js";
import { RCODE } from "../core/types.js";

// Cache for IP sets
const ipSetCache = new Map();

/**
 * Execute IP matcher plugin
 *
 * @param {DnsContext} ctx - DNS request context
 * @param {Object} args - Plugin arguments
 * @returns {Promise<boolean>} True if matched, false otherwise
 */
export async function executeIpMatcher(ctx, args) {
  const {
    files = [],
    ips = [],
    action = "accept",
    inverse = false,
    rcode = RCODE.NXDOMAIN,
  } = args;

  try {
    // Wait for the response to be available
    if (!ctx.response) {
      return false;
    }

    // Extract IPs from DNS response
    const responseIPs = extractIPsFromResponse(ctx.response);

    if (!responseIPs || responseIPs.length === 0) {
      return false;
    }

    // Combine configured IPs and IPs from files
    let ipSet = new Set(ips);

    // Load IPs from files if provided
    if (files && files.length > 0) {
      await loadIPsFromFiles(files, ipSet);
    }

    // Match response IPs against our IP set
    let matched = false;

    for (const ip of responseIPs) {
      if (ipSet.has(ip) || matchSubnet(ip, ipSet)) {
        matched = true;
        break;
      }
    }

    // Handle inverse matching
    if (inverse) {
      matched = !matched;
    }

    if (matched) {
      // Perform action based on match
      if (action === "reject") {
        ctx.setError(rcode);
        ctx.addTag("ip_matcher_rejected");
        ctx.resolved = true;
      } else {
        ctx.addTag("ip_matcher_accepted");
      }
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error in IP matcher plugin:", error);
    return false;
  }
}

/**
 * Extract IP addresses from DNS response
 *
 * @param {ArrayBuffer} responseBuffer - DNS response buffer
 * @returns {Array<string>} Array of IP addresses
 */
function extractIPsFromResponse(responseBuffer) {
  try {
    // This is a simplified implementation
    // In a real implementation, we would parse the DNS response buffer
    // to extract A and AAAA records

    // For now, just return an empty array
    // The actual implementation would depend on the DNS message parsing code
    return [];
  } catch (error) {
    console.error("Error extracting IPs from response:", error);
    return [];
  }
}

/**
 * Match an IP against a set of subnets
 *
 * @param {string} ip - IP address to match
 * @param {Set<string>} subnets - Set of subnet patterns
 * @returns {boolean} True if IP matches any subnet
 */
function matchSubnet(ip, subnets) {
  // Simplified implementation
  // In a real implementation, we would:
  // 1. Parse the IP address
  // 2. Check if it falls within any of the subnets in the set

  // For now, just check if the IP starts with any of the subnets
  for (const subnet of subnets) {
    if (subnet.includes("/") && ip.startsWith(subnet.split("/")[0])) {
      return true;
    }
  }

  return false;
}

/**
 * Load IP addresses from files
 *
 * @param {Array<string>} files - Array of file paths
 * @param {Set<string>} ipSet - Set to add IPs to
 */
async function loadIPsFromFiles(files, ipSet) {
  for (const file of files) {
    // Check cache first
    if (ipSetCache.has(file)) {
      const cachedIPs = ipSetCache.get(file);
      cachedIPs.forEach((ip) => ipSet.add(ip));
      continue;
    }

    try {
      // In Cloudflare Workers, we would load from KV store
      // For this example, we'll just log that we would load from the file
      console.log(`Would load IPs from file: ${file}`);

      // Simulate loading from KV store
      // const ipList = await KV.get(file);
      const ipList = [];

      // Add to cache
      ipSetCache.set(file, ipList);

      // Add to set
      ipList.forEach((ip) => ipSet.add(ip));
    } catch (error) {
      console.error(`Error loading IPs from file ${file}:`, error);
    }
  }
}

/**
 * Register the IP matcher plugin
 */
export function register() {
  registerPlugin("ip_matcher", executeIpMatcher);
}
