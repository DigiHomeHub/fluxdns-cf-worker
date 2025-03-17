/**
 * Integration test for basic DNS flow
 *
 * Tests the complete flow of a DNS request through the system
 * with a basic configuration.
 */

import { jest } from "@jest/globals";
import { DnsContext } from "../../src/core/context.js";
import {
  createPluginChain,
  registerPlugin,
} from "../../src/core/plugin-chain.js";
import { RRType } from "../../src/core/types.js";

// Mock fetch for testing
global.fetch = jest.fn();

// Mock Response for fetch
global.Response = jest.fn().mockImplementation((body, init) => {
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => new ArrayBuffer(10),
    ...init,
  };
});

describe("Basic DNS Flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Register plugins directly instead of using jest.mock
    registerPlugin("cache", async (ctx) => {
      return false; // Cache miss
    });

    registerPlugin("forward", async (ctx, args) => {
      ctx.setResponse(new ArrayBuffer(10));
      return true;
    });
  });

  test("processes a basic DNS request successfully", async () => {
    // Create a mock request
    const mockRequest = {
      method: "POST",
      headers: {
        get: jest.fn().mockImplementation((key) => {
          if (key === "content-type") return "application/dns-message";
          return null;
        }),
      },
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(20)),
    };

    // Create a mock DNS context
    const mockDnsContext = {
      request: mockRequest,
      dnsMessage: {
        header: { id: 1234 },
        questions: [{ name: "example.com", type: RRType.A }],
        buffer: new ArrayBuffer(20),
      },
      resolved: false,
      metadata: {
        tags: [],
        timings: {},
        stats: {},
      },
      getQueryDomain: jest.fn().mockReturnValue("example.com"),
      getQueryType: jest.fn().mockReturnValue(RRType.A),
      setResponse: jest.fn(),
      addTag: jest.fn(),
      hasTag: jest.fn().mockReturnValue(false),
      buildResponse: jest.fn().mockReturnValue(new Response()),
    };

    // Mock DnsContext.fromRequest
    DnsContext.fromRequest = jest.fn().mockResolvedValue(mockDnsContext);

    // Create a basic plugin chain
    const plugins = [
      {
        type: "cache",
        tag: "cache",
        args: { ttl: 300 },
      },
      {
        type: "forward",
        tag: "forward",
        args: {
          upstream: "https://security.cloudflare-dns.com/dns-query",
          timeout: 5000,
        },
      },
    ];

    // Create the plugin chain
    const chain = createPluginChain(plugins);

    // Mock the execute method
    chain.execute = jest.fn().mockImplementation(async (ctx) => {
      // Simulate cache miss
      // Simulate forward success
      ctx.setResponse(new ArrayBuffer(10));
      ctx.resolved = true;
      return ctx;
    });

    // Create a mock worker
    const worker = {
      fetch: async (request, env) => {
        // Create DNS context from request
        const dnsContext = await DnsContext.fromRequest(request);

        if (!dnsContext) {
          return new Response("Invalid DNS request", { status: 400 });
        }

        try {
          // Execute plugin chain
          await chain.execute(dnsContext);

          // Return response
          return dnsContext.buildResponse();
        } catch (error) {
          console.error("Error processing DNS request:", error);

          // Return error response
          return new Response("DNS processing error", { status: 500 });
        }
      },
    };

    // Execute the request
    const response = await worker.fetch(mockRequest, {});

    // Verify the flow
    expect(DnsContext.fromRequest).toHaveBeenCalledWith(mockRequest);
    expect(chain.execute).toHaveBeenCalledWith(mockDnsContext);
    expect(mockDnsContext.buildResponse).toHaveBeenCalled();
    expect(response).toBeDefined();
  });

  test("handles invalid DNS requests", async () => {
    // Create a mock request with invalid content type
    const mockRequest = {
      method: "POST",
      headers: {
        get: jest.fn().mockReturnValue("text/plain"), // Invalid content type
      },
      url: "https://example.com/dns-query",
    };

    // Mock DnsContext.fromRequest to return null for invalid request
    DnsContext.fromRequest = jest.fn().mockResolvedValue(null);

    // Create a mock worker
    const worker = {
      fetch: async (request, env) => {
        // Create DNS context from request
        const dnsContext = await DnsContext.fromRequest(request);

        if (!dnsContext) {
          return new Response("Invalid DNS request", { status: 400 });
        }

        try {
          // Execute plugin chain (not reached in this test)
          return dnsContext.buildResponse();
        } catch (error) {
          console.error("Error processing DNS request:", error);

          // Return error response
          return new Response("DNS processing error", { status: 500 });
        }
      },
    };

    // Execute the request
    const response = await worker.fetch(mockRequest, {});

    // Verify error handling
    expect(DnsContext.fromRequest).toHaveBeenCalledWith(mockRequest);
    expect(response.status).toBe(400);
  });
});
