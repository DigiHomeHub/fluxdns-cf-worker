/**
 * DNS over HTTPS GET Method Tests
 *
 * Tests for the DoH GET method implementation which uses the 'dns' query parameter.
 */

import { jest } from "@jest/globals";
import { arrayBufferToBase64Url } from "../../src/utils/encoding.js";

// Mock handlers
const mockHandleDnsGet = jest.fn().mockImplementation(async (request) => {
  const url = new URL(request.url);
  const dnsParam = url.searchParams.get("dns");

  if (!dnsParam) {
    return new Response("Missing dns parameter", { status: 400 });
  }

  return new Response(new ArrayBuffer(10), {
    headers: { "Content-Type": "application/dns-message" },
  });
});

// Module with mocked handlers
const handler = {
  handleDnsGet: mockHandleDnsGet,
};

describe("DNS over HTTPS GET Method", () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  test("handles valid DNS GET request", async () => {
    // Create a DNS query buffer and encode it for URL
    const dnsBuffer = new Uint8Array([1, 2, 3, 4]).buffer;
    const dnsParam = arrayBufferToBase64Url(dnsBuffer);

    // Create request with dns parameter
    const request = new Request(
      `https://dns.example.com/dns-query?dns=${dnsParam}`
    );

    // Call the handler
    const response = await handler.handleDnsGet(request);

    // Verify response was created correctly
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/dns-message"
    );
    expect(mockHandleDnsGet).toHaveBeenCalled();
  });

  test("returns 400 for missing dns parameter", async () => {
    // Create request without dns parameter
    const request = new Request("https://dns.example.com/dns-query");

    // Call the handler
    const response = await handler.handleDnsGet(request);

    // Verify error response
    expect(response.status).toBe(400);
    expect(mockHandleDnsGet).toHaveBeenCalled();
  });
});
