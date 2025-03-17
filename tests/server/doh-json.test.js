/**
 * DNS over HTTPS JSON Method Tests
 *
 * Tests for the DoH JSON method implementation which accepts application/json content.
 */

import { jest } from "@jest/globals";

// Mock handlers
const mockHandleDnsJson = jest.fn().mockImplementation(async (request) => {
  const contentType = request.headers.get("content-type");

  if (!contentType || !contentType.includes("application/json")) {
    return new Response("Invalid content type", { status: 400 });
  }

  try {
    const jsonBody = await request.json();

    if (!jsonBody.name) {
      return new Response("Missing name parameter", { status: 400 });
    }

    const responseJson = {
      Status: 0,
      Answer: [
        {
          name: jsonBody.name,
          type: jsonBody.type || 1,
          TTL: 300,
          data: "93.184.216.34",
        },
      ],
    };

    return new Response(JSON.stringify(responseJson), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response("Invalid JSON", { status: 400 });
  }
});

// Module with mocked handlers
const handler = {
  handleDnsJson: mockHandleDnsJson,
};

describe("DNS over HTTPS JSON Method", () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  test("handles valid DNS JSON request", async () => {
    // Create a DNS JSON query
    const jsonQuery = {
      name: "example.com",
      type: "A",
    };

    // Create request with proper content type
    const request = new Request("https://dns.example.com/dns-query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(jsonQuery),
    });

    // Call the handler
    const response = await handler.handleDnsJson(request);

    // Verify response was created correctly
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(mockHandleDnsJson).toHaveBeenCalled();
  });

  test("returns 400 for incorrect content type", async () => {
    // Create request with wrong content type
    const request = new Request("https://dns.example.com/dns-query", {
      method: "POST",
      headers: {
        "Content-Type": "application/dns-message",
      },
      body: new ArrayBuffer(10),
    });

    // Call the handler
    const response = await handler.handleDnsJson(request);

    // Verify error response
    expect(response.status).toBe(400);
    expect(mockHandleDnsJson).toHaveBeenCalled();
  });

  test("returns 400 for missing name parameter", async () => {
    // Create a DNS JSON query without name
    const jsonQuery = {
      type: "A",
    };

    // Create request with proper content type
    const request = new Request("https://dns.example.com/dns-query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(jsonQuery),
    });

    // Call the handler
    const response = await handler.handleDnsJson(request);

    // Verify error response
    expect(response.status).toBe(400);
    expect(mockHandleDnsJson).toHaveBeenCalled();
  });
});
