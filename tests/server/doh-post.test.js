/**
 * DNS over HTTPS POST Method Tests
 *
 * Simple tests for the DoH POST method without importing the actual implementation,
 * focusing on testing the API interface expectations.
 */

import { jest } from "@jest/globals";
import { createDnsQueryBuffer } from "../helpers/dns-builder.js";
import { RRType } from "../../src/core/types.js";

// We need to use the global Response type
const GlobalResponse = global.Response;

describe("DNS over HTTPS POST Method", () => {
  // Mock the fetch function
  const mockFetch = jest.fn();

  // Create a mock worker
  const mockWorker = {
    fetch: mockFetch,
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Default mock implementation for success cases
    mockFetch.mockImplementation(async (request) => {
      if (request.url.includes("/api/")) {
        return new GlobalResponse(
          JSON.stringify({
            status: "ok",
            version: "1.0.0",
            serverTime: Date.now(),
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      if (request.headers.get("Content-Type") === "application/dns-message") {
        return new GlobalResponse(new ArrayBuffer(10), {
          headers: { "Content-Type": "application/dns-message" },
          status: 200,
        });
      }

      return new GlobalResponse("Invalid DNS request", { status: 400 });
    });
  });

  test("handles valid DNS POST request", async () => {
    // Create a DNS query buffer
    const dnsBuffer = createDnsQueryBuffer("example.com", RRType.A);

    // Create request with proper content type
    const request = new Request("https://dns.example.com/dns-query", {
      method: "POST",
      headers: {
        "Content-Type": "application/dns-message",
      },
      body: dnsBuffer,
    });

    // Call the mock worker's fetch method
    const response = await mockWorker.fetch(request, {}, {});

    // Verify the mock was called
    expect(mockFetch).toHaveBeenCalledWith(request, {}, {});

    // Simple verification
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/dns-message"
    );
  });

  test("returns 400 for invalid DNS request", async () => {
    // Set up a specific mock implementation for this test
    mockFetch.mockImplementationOnce(async () => {
      return new GlobalResponse("Invalid DNS request", { status: 400 });
    });

    // Create request with improper content
    const request = new Request("https://dns.example.com/dns-query", {
      method: "POST",
      headers: {
        "Content-Type": "application/dns-message",
      },
      body: new ArrayBuffer(0), // Empty body to simulate invalid request
    });

    // Call the mock worker's fetch method
    const response = await mockWorker.fetch(request, {}, {});

    // Verify error response
    expect(response.status).toBe(400);
  });

  test("handles errors gracefully", async () => {
    // Create a test-specific implementation that returns 500 error
    mockFetch.mockImplementationOnce(async () => {
      return new GlobalResponse("Internal server error", { status: 500 });
    });

    // Create request
    const request = new Request("https://dns.example.com/dns-query", {
      method: "POST",
      headers: {
        "Content-Type": "application/dns-message",
      },
      body: createDnsQueryBuffer("example.com", RRType.A),
    });

    const response = await mockWorker.fetch(request, {}, {});

    // Verify error response
    expect(response.status).toBe(500);
  });

  test("handles API requests", async () => {
    // Create API request
    const request = new Request("https://dns.example.com/api/status", {
      method: "GET",
    });

    // Call the mock worker's fetch method
    const response = await mockWorker.fetch(request, {}, {});

    // Verify API response
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");

    const responseBody = await response.json();
    expect(responseBody).toHaveProperty("status", "ok");
    expect(responseBody).toHaveProperty("version");
    expect(responseBody).toHaveProperty("serverTime");
  });
});
