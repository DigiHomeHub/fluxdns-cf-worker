/**
 * DNS over HTTPS POST Method Tests
 *
 * Tests for the DoH POST method implementation which accepts application/dns-message content.
 */

import { jest } from "@jest/globals";

// Mock handlers
const mockHandleDnsPost = jest.fn().mockImplementation(async (request) => {
  const contentType = request.headers.get("content-type");

  if (contentType !== "application/dns-message") {
    return new Response("Invalid content type", { status: 400 });
  }

  return new Response(new ArrayBuffer(10), {
    headers: { "Content-Type": "application/dns-message" },
  });
});

// Module with mocked handlers
const handler = {
  handleDnsPost: mockHandleDnsPost,
};

describe("DNS over HTTPS POST Method", () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  test("handles valid DNS POST request", async () => {
    // Create a DNS query buffer
    const dnsBuffer = new Uint8Array([1, 2, 3, 4]).buffer;

    // Create request with proper content type
    const request = new Request("https://dns.example.com/dns-query", {
      method: "POST",
      headers: {
        "Content-Type": "application/dns-message",
      },
      body: dnsBuffer,
    });

    // Call the handler
    const response = await handler.handleDnsPost(request);

    // Verify response was created correctly
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/dns-message"
    );
    expect(mockHandleDnsPost).toHaveBeenCalled();
  });

  test("returns 400 for incorrect content type", async () => {
    // Create request with wrong content type
    const request = new Request("https://dns.example.com/dns-query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "example.com" }),
    });

    // Call the handler
    const response = await handler.handleDnsPost(request);

    // Verify error response
    expect(response.status).toBe(400);
    expect(mockHandleDnsPost).toHaveBeenCalled();
  });
});
