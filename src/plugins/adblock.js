/**
 * Ad Blocking Plugin
 *
 * Blocks DNS queries for ad domains to prevent ads from loading.
 * Uses both static lists and heuristic patterns for detection.
 */

import { registerPlugin } from "../core/plugin-chain.js";
import { RCODE } from "../core/types.js";

// Common ad domain patterns
const AD_PATTERNS = [
  "ads",
  "ad.",
  "adserver",
  "advert",
  "banner",
  "track",
  "tracker",
  "tracking",
  "analytics",
  "stats",
  "pixel",
  "metrics",
  "marketing",
];

/**
 * Execute the ad blocking plugin
 *
 * @param {DnsContext} ctx - DNS request context
 * @param {Object} args - Plugin arguments
 * @returns {Promise<boolean>} True if blocked, false otherwise
 */
export async function executeAdBlock(ctx, args) {
  const domain = ctx.getQueryDomain();

  if (!domain) {
    return false;
  }

  const { patterns = AD_PATTERNS, whitelist = [], log = true } = args;

  // Check whitelist first
  for (const whitelistDomain of whitelist) {
    if (
      domain === whitelistDomain ||
      (domain.endsWith("." + whitelistDomain) &&
        domain.length > whitelistDomain.length + 1)
    ) {
      if (log) {
        console.log(`Skipping whitelisted domain: ${domain}`);
      }
      return false;
    }
  }

  // Check against patterns
  let blocked = false;

  // Check for exact match or pattern match
  for (const pattern of patterns) {
    if (domain.includes(pattern)) {
      blocked = true;
      break;
    }
  }

  if (blocked) {
    if (log) {
      console.log(`Blocking ad domain: ${domain}`);
    }

    // Set NXDOMAIN response
    ctx.setError(RCODE.NXDOMAIN);
    ctx.resolved = true;
    ctx.addTag("adblock_filtered");

    return true;
  }

  return false;
}

/**
 * Register the ad blocker plugin
 */
export function register() {
  registerPlugin("adblock", executeAdBlock);
}
