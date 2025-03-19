/**
 * DNS over HTTPS JSON Method Tests
 *
 * Integration tests for the DoH JSON method against a locally running wrangler development server.
 * These tests should be run after starting the server with `wrangler dev --local`.
 */

import { jest } from "@jest/globals";
import fetch from "node-fetch";
import { RRType } from "../../src/core/types.js";

describe("DNS over HTTPS JSON Method (Integration)", () => {
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

  test("handles valid DNS JSON request", async () => {
    // Create request with proper query parameters
    const response = await fetch(
      `${baseUrl}/dns-query?name=example.com&type=A`,
      {
        method: "GET",
        headers: {
          Accept: "application/dns-json",
        },
      }
    );

    // Verify response
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/dns-json");

    // Verify JSON response format
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty("Status");
    expect(responseBody).toHaveProperty("Question");
    expect(responseBody).toHaveProperty("Answer");
    expect(responseBody.Question[0]).toHaveProperty("name", "example.com");
    expect(responseBody.Question[0]).toHaveProperty("type", 1); // A record
  });

  test("returns 400 for missing name parameter", async () => {
    // Create request without name parameter
    const response = await fetch(`${baseUrl}/dns-query?type=A`, {
      method: "GET",
      headers: {
        Accept: "application/dns-json",
      },
    });

    // Verify error response - either 400 Bad Request or error in JSON
    if (response.status === 200) {
      const body = await response.text();
      expect(body).toContain("error");
    } else {
      expect(response.status).toBe(400);
    }
  });

  test("handles valid name with various record types", async () => {
    const recordTypes = ["A", "AAAA", "MX", "TXT", "NS"];

    for (const type of recordTypes) {
      // Create request with each record type
      const response = await fetch(
        `${baseUrl}/dns-query?name=example.com&type=${type}`,
        {
          method: "GET",
          headers: {
            Accept: "application/dns-json",
          },
        }
      );

      // All valid queries should return 200 status
      expect(response.status).toBe(200);

      // Parse response
      const body = await response.json();

      // Each response should have the Question section matching our query
      expect(body.Question[0].name).toBe("example.com");
      expect(body.Question[0].type).toBe(RRType[type]);
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
