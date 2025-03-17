/**
 * Example of a custom plugin for FluxDNS
 *
 * This file demonstrates how to create a custom plugin that can be added to the plugin chain.
 */

import { registerPlugin } from "../src/core/plugin-chain";
import { RCODE } from "../src/core/types";

/**
 * A custom plugin that logs DNS queries and can optionally modify responses
 *
 * @param {Object} context - The DNS context object
 * @param {Object} args - Plugin arguments
 * @returns {Promise<void>}
 */
export async function executeLogger(context, args = {}) {
  const {
    logLevel = "info",
    addHeader = false,
    modifyTtl = false,
    newTtl = 300,
  } = args;

  const domain = context.query?.questions?.[0]?.name || "unknown";
  const type = context.query?.questions?.[0]?.type || "unknown";

  // Log the query based on the configured log level
  if (logLevel === "debug") {
    console.debug(`[FluxDNS] DNS Query: ${domain} (${type})`);
    console.debug(`[FluxDNS] Query details:`, JSON.stringify(context.query));
  } else if (logLevel === "info") {
    console.info(`[FluxDNS] DNS Query: ${domain} (${type})`);
  }

  // Add a custom header to the response if enabled
  if (addHeader && context.response) {
    context.responseHeaders = context.responseHeaders || {};
    context.responseHeaders["X-FluxDNS-Processed"] = "true";
  }

  // Modify TTL in the response if enabled and we have a response
  if (modifyTtl && context.response && context.response.answers) {
    for (const answer of context.response.answers) {
      answer.ttl = newTtl;
    }
  }

  // Add a tag to indicate this plugin processed the request
  context.addTag("logger_processed");

  // Continue to the next plugin
  return;
}

/**
 * A custom plugin that implements IP-based geolocation filtering
 *
 * @param {Object} context - The DNS context object
 * @param {Object} args - Plugin arguments
 * @returns {Promise<void>}
 */
export async function executeGeoFilter(context, args = {}) {
  const {
    allowedCountries = [],
    blockedCountries = [],
    action = "reject",
    fallbackIps = [],
  } = args;

  // Get client country from request (assuming Cloudflare provides this)
  const clientCountry = context.request.headers.get("cf-ipcountry");

  if (!clientCountry) {
    console.warn(
      "[FluxDNS] No country information available for geo-filtering"
    );
    return; // Continue to next plugin if no country info
  }

  // Check if client country is allowed
  if (
    allowedCountries.length > 0 &&
    !allowedCountries.includes(clientCountry)
  ) {
    if (action === "reject") {
      // Reject the request with REFUSED
      context.response = {
        id: context.query.id,
        flags: 0x8180, // Standard response flags
        questions: context.query.questions,
        answers: [],
        authorities: [],
        additionals: [],
      };
      context.rcode = RCODE.REFUSED;
      context.resolved = true;
      context.addTag("geo_blocked");
    } else if (action === "redirect" && fallbackIps.length > 0) {
      // Create a response with fallback IPs
      const question = context.query.questions[0];
      context.response = {
        id: context.query.id,
        flags: 0x8180, // Standard response flags
        questions: context.query.questions,
        answers: fallbackIps.map((ip) => ({
          name: question.name,
          type: question.type,
          class: question.class,
          ttl: 300,
          data: ip,
        })),
        authorities: [],
        additionals: [],
      };
      context.resolved = true;
      context.addTag("geo_redirected");
    }
    return;
  }

  // Check if client country is blocked
  if (blockedCountries.length > 0 && blockedCountries.includes(clientCountry)) {
    if (action === "reject") {
      // Reject the request with REFUSED
      context.response = {
        id: context.query.id,
        flags: 0x8180, // Standard response flags
        questions: context.query.questions,
        answers: [],
        authorities: [],
        additionals: [],
      };
      context.rcode = RCODE.REFUSED;
      context.resolved = true;
      context.addTag("geo_blocked");
    } else if (action === "redirect" && fallbackIps.length > 0) {
      // Create a response with fallback IPs
      const question = context.query.questions[0];
      context.response = {
        id: context.query.id,
        flags: 0x8180, // Standard response flags
        questions: context.query.questions,
        answers: fallbackIps.map((ip) => ({
          name: question.name,
          type: question.type,
          class: question.class,
          ttl: 300,
          data: ip,
        })),
        authorities: [],
        additionals: [],
      };
      context.resolved = true;
      context.addTag("geo_redirected");
    }
    return;
  }

  // Country is allowed, continue to next plugin
  context.addTag("geo_allowed");
  return;
}

// Register the custom plugins
registerPlugin("logger", executeLogger);
registerPlugin("geofilter", executeGeoFilter);

// Example usage in a plugin chain:
/*
import { createPluginChain } from '../src/core/plugin-chain';
import './custom-plugin';

const pluginChain = createPluginChain([
  {
    name: 'logger',
    args: {
      logLevel: 'debug',
      addHeader: true
    }
  },
  {
    name: 'geofilter',
    args: {
      allowedCountries: ['US', 'CA', 'GB'],
      action: 'reject'
    }
  },
  {
    name: 'forward',
    args: {
      upstream: 'https://cloudflare-dns.com/dns-query'
    }
  }
]);
*/
