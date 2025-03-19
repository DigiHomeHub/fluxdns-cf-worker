/**
 * DNS over HTTPS GET Method Tests
 *
 * Integration tests for the DoH GET method against a locally running wrangler development server.
 * These tests should be run after starting the server with `wrangler dev --local`.
 */

import { jest } from "@jest/globals";
import fetch from "node-fetch";
import { createDnsQueryBuffer } from "../helpers/dns-builder.js";
import { RRType } from "../../src/core/types.js";
import { arrayBufferToBase64Url } from "../../src/utils/encoding.js";

describe("DNS over HTTPS GET Method (Integration)", () => {
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

  test("handles valid DNS GET request with dns parameter", async () => {
    // Create a DNS query buffer
    const dnsBuffer = createDnsQueryBuffer("example.com", RRType.A);

    // Convert to base64url for GET parameter
    const dnsParam = arrayBufferToBase64Url(dnsBuffer);

    // Send actual request to local server
    const response = await fetch(`${baseUrl}/dns-query?dns=${dnsParam}`, {
      method: "GET",
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

  test("returns 400 for missing dns parameter", async () => {
    // Create request without dns parameter
    const response = await fetch(`${baseUrl}/dns-query`, {
      method: "GET",
    });

    // Verify error response
    expect(response.status).toBe(400);
  });

  test("handles errors gracefully", async () => {
    // Send invalid DNS parameter
    const response = await fetch(`${baseUrl}/dns-query?dns=INVALID-DNS-DATA`, {
      method: "GET",
    });

    // Expect a 400 Bad Request or 500 Internal Server Error
    expect([400, 500]).toContain(response.status);
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
