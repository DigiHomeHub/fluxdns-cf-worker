/**
 * Matcher Plugin
 *
 * Matches DNS queries against patterns and takes actions based on matches.
 */

import { registerPlugin } from "../core/plugin-chain.js";
import { RCODE } from "../core/types.js";

/**
 * Execute matcher plugin
 *
 * @param {DnsContext} ctx - DNS request context
 * @param {Object} args - Plugin arguments
 * @returns {Promise<boolean>} True if matched, false otherwise
 */
export async function executeMatcher(ctx, args) {
  const domain = ctx.getQueryDomain();
  const type = ctx.getQueryType();

  if (!domain) {
    return false;
  }

  // Type matching, if specified
  if (args.type && args.type !== type) {
    return false;
  }

  // Get patterns to match against
  const patterns = [];

  // Domain list
  if (args.domains && Array.isArray(args.domains)) {
    patterns.push(...args.domains);
  }

  // Domain patterns
  if (args.patterns && Array.isArray(args.patterns)) {
    patterns.push(...args.patterns);
  }

  // Single domain
  if (args.domain) {
    if (Array.isArray(args.domain)) {
      patterns.push(...args.domain);
    } else {
      patterns.push(args.domain);
    }
  }

  // No patterns to match against
  if (patterns.length === 0) {
    return false;
  }

  // Check for matches
  let matched = false;

  try {
    for (const pattern of patterns) {
      // Exact match
      if (pattern === domain) {
        matched = true;
        break;
      }

      // Subdomain match (*.example.com)
      if (
        typeof pattern === "string" &&
        pattern.startsWith("*.") &&
        domain.endsWith(pattern.slice(1))
      ) {
        matched = true;
        break;
      }

      // Simple pattern match (contains)
      if (typeof pattern === "string" && domain.includes(pattern)) {
        matched = true;
        break;
      }

      // Regex pattern
      if (pattern instanceof RegExp && pattern.test(domain)) {
        matched = true;
        break;
      }
    }
  } catch (error) {
    console.error("Error in matcher plugin:", error);
    return false;
  }

  // Apply inverse matching if requested
  if (args.inverse) {
    matched = !matched;
  }

  // No match
  if (!matched) {
    return false;
  }

  // Match found - perform action
  const action = args.action || "accept";

  if (action === "reject") {
    ctx.setError(args.rcode || RCODE.NXDOMAIN);
    ctx.resolved = true;
    ctx.addTag("matcher_rejected");
  } else {
    ctx.addTag("matcher_accepted");
  }

  return true;
}

/**
 * Register the matcher plugin
 */
export function register() {
  registerPlugin("matcher", executeMatcher);
}
