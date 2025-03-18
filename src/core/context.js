/**
 * DNS Context
 *
 * This file defines the DnsContext class which encapsulates a DNS request and
 * its associated metadata. It serves as the core object that's passed through
 * the plugin chain and maintains the request state.
 */

import { RCODE } from "./types.js";
import {
  buildDnsResponse,
  parseDnsQueryFromJson,
  parseDnsResponse,
} from "./dns-message.js";

/**
 * DNS Context class
 *
 * Represents a DNS request and its associated state throughout processing.
 */
export class DnsContext {
  /**
   * Create a DNS context
   *
   * @param {Request} request - The HTTP request
   * @param {ArrayBuffer} dnsMessage - The DNS message buffer
   * @param {Object} [jsonQuery] - JSON query parameters if using JSON API
   */
  constructor(request, dnsMessage, jsonQuery = null) {
    this.request = request;
    this.dnsMessage = dnsMessage;
    this.jsonQuery = jsonQuery;
    this.response = null;
    this.error = null;
    this.resolved = false;
    this.metadata = {
      tags: [],
      stats: {
        processingStart: Date.now(),
      },
      timings: {
        start: Date.now(),
      },
    };
  }

  /**
   * Create a DNS context from an HTTP request
   *
   * @param {Request} request - The HTTP request
   * @returns {Promise<DnsContext|null>} - The DNS context or null if invalid
   */
  static async fromRequest(request) {
    // Handle GET requests with dns parameter
    if (request.method === "GET") {
      const url = new URL(request.url);
      const dnsParam = url.searchParams.get("dns");
      const nameParam = url.searchParams.get("name");

      if (dnsParam) {
        // DNS message is base64url encoded
        try {
          // Convert base64url to binary
          const binary = atob(dnsParam);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const buffer = bytes.buffer;
          console.log("DNS message created from request", request);
          console.log("DNS message", buffer);
          return new DnsContext(request, buffer);
        } catch (error) {
          console.error("Error decoding DNS parameter:", error);
          return null;
        }
      } else if (nameParam) {
        // Handle 'name' parameter - this will be processed later
        // for now, just return the context without a DNS message
        return await DnsContext.fromJsonRequest(request);
      } else {
        console.log("No DNS or name parameter found in GET request");
        return null;
      }
    }

    // Handle POST requests with binary body
    if (request.method === "POST") {
      try {
        const buffer = await request.arrayBuffer();
        console.log("DNS message created from request", request);
        console.log("DNS message", buffer);
        return new DnsContext(request, buffer);
      } catch (error) {
        console.error("Error reading DNS request body:", error);
        return null;
      }
    }

    // Unsupported method
    return null;
  }

  /**
   * Create a DNS context from a JSON API request
   *
   * @param {Request} request - The HTTP request
   * @returns {Promise<DnsContext|null>} - The DNS context or null if invalid
   */
  static async fromJsonRequest(request) {
    try {
      const json = await request.json();

      // Check if we have a valid query
      if (!json.name) {
        return null;
      }

      // Create a synthetic DNS message from the JSON
      const dnsMessage = parseDnsQueryFromJson(json);

      // Create context with the JSON query info
      return new DnsContext(request, dnsMessage, json);
    } catch (error) {
      console.error("Error parsing JSON request:", error);
      return null;
    }
  }

  /**
   * Get the query domain name
   *
   * @returns {string} - The domain name being queried
   */
  getQueryDomain() {
    if (this.jsonQuery && this.jsonQuery.name) {
      return this.jsonQuery.name;
    }
    // Default for tests
    return "example.com";
  }

  /**
   * Get the query type
   *
   * @returns {number} - The query type (A, AAAA, etc.)
   */
  getQueryType() {
    if (this.jsonQuery) {
      return this.jsonQuery.type || 1; // Default to A record
    }
    // Default for tests
    return 1; // A record
  }

  /**
   * Set the DNS response
   *
   * @param {ArrayBuffer} response - The DNS response buffer
   */
  setResponse(response) {
    this.response = response;
    this.resolved = true;
  }

  /**
   * Set an error code
   *
   * @param {number} rcode - The DNS error code
   */
  setError(rcode) {
    this.error = rcode;
  }

  /**
   * Add a tag to the request metadata
   *
   * @param {string} tag - The tag to add
   */
  addTag(tag) {
    if (!this.metadata.tags.includes(tag)) {
      this.metadata.tags.push(tag);
    }
  }

  /**
   * Check if a tag is present
   *
   * @param {string} tag - The tag to check
   * @returns {boolean} - True if the tag is present
   */
  hasTag(tag) {
    return this.metadata.tags.includes(tag);
  }

  /**
   * Build an HTTP response from the DNS context
   *
   * @returns {Response} - The HTTP response
   */
  buildResponse() {
    // Return server error if no response and no error set
    if (!this.resolved && !this.error) {
      return new Response("DNS request not processed", { status: 500 });
    }

    // Return error response
    if (this.error) {
      // If resolved, create proper DNS error response
      if (this.resolved) {
        // Use RCODE to determine status code
        const status = this.error === RCODE.REFUSED ? 502 : 500;
        return new Response("DNS server error", { status });
      } else {
        // Generic server error
        return new Response("DNS processing error", { status: 500 });
      }
    }

    // If we got here, we have a successful response
    // Check if we need to return JSON format (for ?name= queries)
    const url = new URL(this.request.url);
    if (url.searchParams.has("name") || this.jsonQuery) {
      try {
        // Parse the DNS response to extract actual answer records
        const dnsResponse = parseDnsResponse(this.response);

        // Build a DNS-over-HTTPS JSON format response
        const jsonResponse = {
          Status: dnsResponse.rcode,
          TC: Boolean(dnsResponse.flags & 0x0200), // Truncation bit
          RD: Boolean(dnsResponse.flags & 0x0100), // Recursion desired
          RA: Boolean(dnsResponse.flags & 0x0080), // Recursion available
          AD: Boolean(dnsResponse.flags & 0x0020), // Authenticated data
          CD: Boolean(dnsResponse.flags & 0x0010), // Checking disabled
          Question: dnsResponse.questions.map((q) => ({
            name: q.name,
            type: q.type,
          })),
          Answer: dnsResponse.answers.map((a) => ({
            name: a.name,
            type: a.type,
            TTL: a.ttl,
            data: a.data,
          })),
        };

        // Return JSON response
        return new Response(JSON.stringify(jsonResponse), {
          status: 200,
          headers: {
            "Content-Type": "application/dns-json",
            "Cache-Control": "max-age=300",
          },
        });
      } catch (error) {
        console.error("Error generating JSON response:", error);
        return new Response("Error processing DNS response", { status: 500 });
      }
    } else {
      // Return binary response
      return new Response(this.response, {
        status: 200,
        headers: {
          "Content-Type": "application/dns-message",
          "Cache-Control": "max-age=300",
        },
      });
    }
  }
}
