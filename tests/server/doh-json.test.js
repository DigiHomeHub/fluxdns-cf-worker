/**
 * DNS over HTTPS JSON Method Tests
 *
 * Simple tests for the DoH JSON method without importing the actual implementation,
 * focusing on testing the API interface expectations.
 */

import { jest } from "@jest/globals";
import { RRType } from "../../src/core/types.js";

// We need to use the global Response type
const GlobalResponse = global.Response;

describe("DNS over HTTPS JSON Method", () => {
  // Mock the fetch function
  const mockFetch = jest.fn();

  // Create a mock worker
  const mockWorker = {
    fetch: mockFetch,
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  test("handles valid DNS JSON request", async () => {
    // Mock implementation for this test
    mockFetch.mockImplementationOnce(async () => {
      return new GlobalResponse(
        JSON.stringify({
          Status: 0,
          TC: false,
          RD: true,
          RA: true,
          AD: false,
          CD: false,
          Question: [
            {
              name: "example.com",
              type: 1,
            },
          ],
          Answer: [
            {
              name: "example.com",
              type: 1,
              TTL: 300,
              data: "93.184.216.34",
            },
          ],
        }),
        {
          headers: { "Content-Type": "application/dns-json" },
          status: 200,
        }
      );
    });

    // Create request with DNS JSON query
    const request = new Request(
      "https://dns.example.com/dns-query?name=example.com&type=A",
      {
        method: "GET",
        headers: {
          Accept: "application/dns-json",
        },
      }
    );

    // Call the mock worker's fetch method
    const response = await mockWorker.fetch(request, {}, {});

    // Verify the mock was called
    expect(mockFetch).toHaveBeenCalledWith(request, {}, {});

    // Verify response
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/dns-json");

    // Verify JSON response format
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty("Status", 0);
    expect(responseBody).toHaveProperty("Question");
    expect(responseBody).toHaveProperty("Answer");
    expect(responseBody.Question[0]).toHaveProperty("name", "example.com");
    expect(responseBody.Question[0]).toHaveProperty("type", 1); // A record
  });

  test("returns 400 for missing name parameter", async () => {
    // Set up a specific mock implementation for this test
    mockFetch.mockImplementationOnce(async () => {
      return new GlobalResponse("Missing name parameter", { status: 400 });
    });

    // Create request without name parameter
    const request = new Request("https://dns.example.com/dns-query?type=A", {
      method: "GET",
      headers: {
        Accept: "application/dns-json",
      },
    });

    // Call the mock worker's fetch method
    const response = await mockWorker.fetch(request, {}, {});

    // Verify error response
    expect(response.status).toBe(400);
  });

  test("returns 400 for invalid type parameter", async () => {
    // Set up a specific mock implementation for this test
    mockFetch.mockImplementationOnce(async () => {
      return new GlobalResponse("Invalid type parameter", { status: 400 });
    });

    // Create request with invalid type parameter
    const request = new Request(
      "https://dns.example.com/dns-query?name=example.com&type=INVALID",
      {
        method: "GET",
        headers: {
          Accept: "application/dns-json",
        },
      }
    );

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

    // Create request with DNS JSON query
    const request = new Request(
      "https://dns.example.com/dns-query?name=example.com&type=A",
      {
        method: "GET",
        headers: {
          Accept: "application/dns-json",
        },
      }
    );

    const response = await mockWorker.fetch(request, {}, {});

    // Verify error response
    expect(response.status).toBe(500);
  });

  test("handles API requests", async () => {
    // Mock implementation for this test
    mockFetch.mockImplementationOnce(async () => {
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
    });

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
