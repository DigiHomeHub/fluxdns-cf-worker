/**
 * FluxDNS Request Handler
 *
 * Handles DNS-over-HTTPS requests with support for GET and POST methods.
 */

import { DnsContext } from "./core/context.js";
import { createPluginChain } from "./core/plugin-chain.js";
import {
  arrayBufferToBase64Url,
  base64UrlToArrayBuffer,
} from "./utils/encoding.js";

// Create the plugin chain
const pluginChain = createPluginChain([
  { type: "cache", tag: "dns_cache", ttl: 300 },
  {
    type: "forward",
    tag: "dns_forward",
    upstream: "https://cloudflare-dns.com/dns-query",
  },
]);

/**
 * Process DNS query from GET request with dns parameter
 * @param {Request} request - The HTTP request object
 * @returns {Response} HTTP response with DNS answer
 */
export async function handleDnsGet(request) {
  try {
    // Extract query parameters
    const url = new URL(request.url);
    const dnsParam = url.searchParams.get("dns");

    if (!dnsParam) {
      return new Response("Missing dns parameter", { status: 400 });
    }

    // Decode the DNS message
    const dnsMessage = base64UrlToArrayBuffer(dnsParam);

    // Create DNS context and process the query
    const ctx = await DnsContext.fromRequest(dnsMessage);
    await pluginChain.execute(ctx);

    // Return the response
    return buildResponse(ctx);
  } catch (error) {
    console.error("Error processing DNS GET request:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

/**
 * Process DNS query from POST request with application/dns-message
 * @param {Request} request - The HTTP request object
 * @returns {Response} HTTP response with DNS answer
 */
export async function handleDnsPost(request) {
  try {
    // Check content type
    const contentType = request.headers.get("content-type");
    if (contentType !== "application/dns-message") {
      return new Response("Invalid content type", { status: 400 });
    }

    // Get binary DNS message
    const dnsMessage = await request.arrayBuffer();

    // Create DNS context and process the query
    const ctx = await DnsContext.fromRequest(dnsMessage);
    await pluginChain.execute(ctx);

    // Return the response
    return buildResponse(ctx);
  } catch (error) {
    console.error("Error processing DNS POST request:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

/**
 * Process DNS query from POST request with application/dns-json
 * @param {Request} request - The HTTP request object
 * @returns {Response} HTTP response with DNS answer
 */
export async function handleDnsJson(request) {
  try {
    // Check content type
    const contentType = request.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return new Response("Invalid content type", { status: 400 });
    }

    // Parse JSON request
    const jsonRequest = await request.json();

    // Validate JSON request
    if (!jsonRequest.name) {
      return new Response("Missing name parameter", { status: 400 });
    }

    // Create DNS context from JSON query
    const ctx = await DnsContext.fromJsonRequest(jsonRequest);
    await pluginChain.execute(ctx);

    // Return JSON response
    return buildJsonResponse(ctx);
  } catch (error) {
    console.error("Error processing DNS JSON request:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

/**
 * Main request handler that routes to the appropriate DNS handler
 * @param {Request} request - The HTTP request object
 * @returns {Response} HTTP response
 */
export default async function handleRequest(request) {
  // Check request method
  const method = request.method.toUpperCase();

  // Route to appropriate handler
  if (method === "GET") {
    return handleDnsGet(request);
  } else if (method === "POST") {
    const contentType = request.headers.get("content-type");
    if (contentType === "application/dns-message") {
      return handleDnsPost(request);
    } else if (contentType && contentType.includes("application/json")) {
      return handleDnsJson(request);
    }
  }

  // Method not allowed
  return new Response("Method not allowed", { status: 405 });
}

/**
 * Build HTTP response from DNS context
 * @param {DnsContext} ctx - The DNS context
 * @returns {Response} HTTP response
 */
function buildResponse(ctx) {
  const responseBuffer = ctx.buildResponse();
  const headers = {
    "Content-Type": "application/dns-message",
    "Cache-Control": "max-age=60",
  };

  return new Response(responseBuffer, { headers });
}

/**
 * Build JSON HTTP response from DNS context
 * @param {DnsContext} ctx - The DNS context
 * @returns {Response} HTTP response with JSON
 */
function buildJsonResponse(ctx) {
  const jsonResponse = ctx.buildJsonResponse();
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "max-age=60",
  };

  return new Response(JSON.stringify(jsonResponse), { headers });
}
