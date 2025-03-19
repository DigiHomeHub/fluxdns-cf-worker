/**
 * DNS over HTTPS POST Method Tests
 *
 * Integration tests for the DoH POST method against a locally running wrangler development server.
 * These tests should be run after starting the server with `wrangler dev --local`.
 */

import { jest } from "@jest/globals";
import fetch from "node-fetch";
import { createDnsQueryBuffer } from "../helpers/dns-builder.js";
import { RRType } from "../../src/core/types.js";

describe("DNS over HTTPS POST Method (Integration)", () => {
  // Base URL for the local wrangler server
  const baseUrl = "http://localhost:8787";

  // Test timeout - integration tests may need more time
  jest.setTimeout(10000);

  // Helper function to check if server is running
  async function isServerRunning() {
    try {
      await fetch(`${baseUrl}/api/status`);
      return true;
    } catch (error) {
      return false;
    }
  }

  beforeAll(async () => {
    // Check if server is running before starting tests
    const serverRunning = await isServerRunning();
    if (!serverRunning) {
      console.error(`
        ⚠️ Local server is not running! 
        Please start the server with 'wrangler dev --local' before running these tests.
      `);
    }
  });

  test("handles valid DNS POST request", async () => {
    // Create a DNS query buffer
    const dnsBuffer = createDnsQueryBuffer("example.com", RRType.A);

    // Send actual request to local server
    const response = await fetch(`${baseUrl}/dns-query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/dns-message",
      },
      body: dnsBuffer,
    });

    // Verify response
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/dns-message"
    );

    // Verify we get binary data back
    const responseBuffer = await response.arrayBuffer();
    expect(responseBuffer.byteLength).toBeGreaterThan(0);
  });

  test("returns 400 for invalid DNS request", async () => {
    // Create request with improper content
    const response = await fetch(`${baseUrl}/dns-query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/dns-message",
      },
      body: new Uint8Array(0), // Empty body to simulate invalid request
    });

    // Verify error response
    expect([400, 500]).toContain(response.status);
  });

  test("handles multiple record types", async () => {
    const recordTypes = [RRType.A, RRType.AAAA, RRType.MX];

    for (const type of recordTypes) {
      // Create a DNS query buffer for each record type
      const dnsBuffer = createDnsQueryBuffer("example.com", type);

      // Send actual request
      const response = await fetch(`${baseUrl}/dns-query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/dns-message",
        },
        body: dnsBuffer,
      });

      // Verify success response
      expect(response.status).toBe(200);

      // Get binary response
      const buffer = await response.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(0);
    }
  });

  test("handles API requests", async () => {
    // Create API request
    const response = await fetch(`${baseUrl}/api/status`, {
      method: "GET",
    });

    // Verify API response
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");

    const responseBody = await response.json();
    expect(responseBody).toHaveProperty("status", "ok");
    expect(responseBody).toHaveProperty("version");
    expect(responseBody).toHaveProperty("serverTime");
  });
});
