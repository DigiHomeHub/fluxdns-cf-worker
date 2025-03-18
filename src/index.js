/**
 * FluxDNS - Cloudflare Worker DoH Proxy with Plugin System
 *
 * A flexible DNS-over-HTTPS proxy with a plugin-based architecture,
 * inspired by mosdns.
 */

import { DnsContext } from "./core/context.js";
import { loadConfig, validateConfig } from "./config.js";
import {
  createPluginChain,
  loadPlugins,
  registerPlugin,
} from "./core/plugin-chain.js";
import {
  createPluginChainFromMosDNS,
  convertMosDNSConfig,
} from "./mosdns-adapter.js";
import { registerAllPlugins } from "./plugins/index.js";
import * as yaml from "js-yaml";

// Register all built-in plugins
registerAllPlugins();

// Cloudflare Worker entry point
export default {
  /**
   * Handle incoming requests
   *
   * @param {Request} request - HTTP request
   * @param {Object} env - Environment variables
   * @param {Object} ctx - Execution context
   * @returns {Promise<Response>} HTTP response
   */
  async fetch(request, env, ctx) {
    try {
      // Load configuration
      const config = await loadConfig(env);

      // Basic request validation
      const url = new URL(request.url);
      const path = url.pathname;

      console.log(`Received request for path: ${path}`);

      // Handle API endpoints if configured
      if (path.startsWith("/api/")) {
        console.log("Handling API request");
        return handleApiRequest(request, env, config);
      }

      // Verify this is a standard DoH request to /dns-query
      if (path !== "/dns-query") {
        console.log(
          `Invalid path: ${path}. DoH requests must use /dns-query path.`
        );
        return new Response(
          "Not Found. DoH requests must use /dns-query path.",
          {
            status: 404,
            headers: { "Content-Type": "text/plain" },
          }
        );
      }

      console.log("Processing DNS-over-HTTPS request");

      // Create DNS context from request
      const dnsContext = await DnsContext.fromRequest(request);

      if (!dnsContext) {
        console.log("Invalid DNS request format");
        return new Response("Invalid DNS request", { status: 400 });
      }

      try {
        // Create plugin chain from configuration
        const pluginChain = createPluginChain(config.plugins || []);

        // Execute plugin chain
        await pluginChain.execute(dnsContext);

        // Return response
        return dnsContext.buildResponse();
      } catch (error) {
        console.error("Error processing DNS request:", error);

        // Return error response
        return new Response("DNS processing error", { status: 500 });
      }
    } catch (error) {
      console.error("Error in request handler:", error);
      return new Response("Internal server error", { status: 500 });
    }
  },
};

/**
 * Handle API requests
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment variables
 * @param {Object} config - Current configuration
 * @returns {Promise<Response>} HTTP response
 */
async function handleApiRequest(request, env, config) {
  const url = new URL(request.url);
  const path = url.pathname;

  // API key authentication
  const apiKey =
    url.searchParams.get("key") || request.headers.get("X-API-Key");

  if (env.API_KEY && apiKey !== env.API_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  // API endpoints
  if (path === "/api/status") {
    return new Response(
      JSON.stringify({
        status: "ok",
        version: "1.0.0",
        serverTime: Date.now(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (path === "/api/config" && request.method === "GET") {
    // Return current configuration
    return new Response(JSON.stringify(config), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (path === "/api/config" && request.method === "POST") {
    try {
      // Parse new configuration
      const contentType = request.headers.get("Content-Type") || "";
      let newConfig;

      if (contentType.includes("application/json")) {
        newConfig = await request.json();
      } else if (
        contentType.includes("application/x-yaml") ||
        contentType.includes("text/yaml")
      ) {
        const yamlText = await request.text();
        newConfig = yaml.load(yamlText);

        // Convert MosDNS YAML to FluxDNS config
        if (newConfig.plugins && !validateConfig(newConfig)) {
          newConfig = convertMosDNSConfig(newConfig);
        }
      } else {
        return new Response(
          JSON.stringify({
            status: "error",
            message:
              "Unsupported content type. Use application/json or application/x-yaml",
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 415,
          }
        );
      }

      // Validate configuration
      if (!validateConfig(newConfig)) {
        return new Response(
          JSON.stringify({
            status: "error",
            message: "Invalid configuration",
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 400,
          }
        );
      }

      // In a real implementation, we would store the configuration
      // For this demo, just acknowledge it
      return new Response(
        JSON.stringify({
          status: "success",
          message: "Configuration updated",
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error updating configuration:", error);
      return new Response(
        JSON.stringify({
          status: "error",
          message: "Failed to parse configuration: " + error.message,
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        }
      );
    }
  }

  // Default response for unknown API endpoints
  return new Response("Not Found", { status: 404 });
}
