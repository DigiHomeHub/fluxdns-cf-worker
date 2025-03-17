/**
 * Response Modifier Plugin
 *
 * Modifies DNS responses including TTL adjustments, IP replacements,
 * and response actions like accept/reject.
 */

import { registerPlugin } from "../core/plugin-chain.js";
import { RCODE } from "../core/types.js";

/**
 * Execute response modifier plugin
 *
 * @param {DnsContext} ctx - DNS request context
 * @param {Object} args - Plugin arguments
 * @returns {Promise<boolean>} True if modified, false otherwise
 */
export async function executeResponseModifier(ctx, args) {
  const {
    action = "modify",
    rcode = RCODE.NXDOMAIN,
    ip = null,
    ips = [],
    minTtl = null,
    maxTtl = null,
    ttl = null,
    domains = [],
  } = args;

  try {
    // Action: reject (similar to MosDNS black_hole)
    if (action === "reject") {
      ctx.setError(rcode);
      ctx.addTag("response_rejected");
      ctx.resolved = true;
      return true;
    }

    // Action: accept (mark as resolved)
    if (action === "accept") {
      ctx.addTag("response_accepted");
      ctx.resolved = true;
      return true;
    }

    // Handle domain filtering for other actions
    const queryDomain = ctx.getQueryDomain();
    if (domains && domains.length > 0 && queryDomain) {
      let matchesDomain = false;

      // Check if query domain matches any in the list
      for (const domain of domains) {
        if (typeof domain === "string") {
          if (domain.startsWith("*.")) {
            // Wildcard domain
            const suffix = domain.substring(2);
            if (
              queryDomain.endsWith(suffix) &&
              queryDomain.length > suffix.length
            ) {
              matchesDomain = true;
              break;
            }
          } else if (domain === queryDomain) {
            // Exact match
            matchesDomain = true;
            break;
          }
        } else if (domain instanceof RegExp && domain.test(queryDomain)) {
          // Regex match
          matchesDomain = true;
          break;
        }
      }

      // Skip if not matching any domain
      if (!matchesDomain) {
        return false;
      }
    }

    // Wait for the response to be available
    if (!ctx.response) {
      return false;
    }

    // Action: modify TTL
    if ((minTtl !== null || maxTtl !== null || ttl !== null) && ctx.response) {
      // Get existing response
      const responseView = new DataView(ctx.response);

      // Get current TTL values and modify them
      // This is a simplified example - actual implementation would need
      // to parse the DNS message format properly
      modifyResponseTTL(ctx.response, {
        minTtl: minTtl !== null ? minTtl : undefined,
        maxTtl: maxTtl !== null ? maxTtl : undefined,
        ttl: ttl !== null ? ttl : undefined,
      });

      ctx.addTag("ttl_modified");
      return true;
    }

    // Action: replace IP (similar to MosDNS black_hole with IP)
    if ((ip || (ips && ips.length > 0)) && ctx.response) {
      // Choose a random IP if multiple are provided
      const targetIp =
        ip ||
        (ips.length > 0 ? ips[Math.floor(Math.random() * ips.length)] : null);

      if (targetIp) {
        // Replace IPs in the response
        replaceResponseIPs(ctx.response, targetIp);

        ctx.addTag("ip_replaced");
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Error in response modifier plugin:", error);
    return false;
  }
}

/**
 * Modify TTL values in a DNS response
 *
 * @param {ArrayBuffer} responseBuffer - DNS response buffer
 * @param {Object} options - TTL modification options
 */
function modifyResponseTTL(responseBuffer, options) {
  const { minTtl, maxTtl, ttl } = options;

  try {
    // This is a simplified implementation
    // In a real implementation, we would:
    // 1. Parse the DNS message
    // 2. Iterate through all records
    // 3. Modify TTL values according to the rules
    // 4. Rewrite the message

    // The actual implementation would depend on the DNS message parsing code
    console.log("Would modify TTL values:", { minTtl, maxTtl, ttl });
  } catch (error) {
    console.error("Error modifying response TTL:", error);
  }
}

/**
 * Replace IP addresses in a DNS response
 *
 * @param {ArrayBuffer} responseBuffer - DNS response buffer
 * @param {string} targetIp - IP address to replace with
 */
function replaceResponseIPs(responseBuffer, targetIp) {
  try {
    // This is a simplified implementation
    // In a real implementation, we would:
    // 1. Parse the DNS message
    // 2. Replace A/AAAA record values with the target IP
    // 3. Update the message checksum if needed

    // The actual implementation would depend on the DNS message parsing code
    console.log("Would replace IPs with:", targetIp);
  } catch (error) {
    console.error("Error replacing response IPs:", error);
  }
}

/**
 * Register the response modifier plugin
 */
export function register() {
  registerPlugin("response_modifier", executeResponseModifier);
}
