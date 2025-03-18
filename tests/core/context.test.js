/**
 * Unit tests for the DNS Context
 *
 * These tests verify the functionality of the DnsContext class, including
 * request parsing, query extraction, response building, and metadata handling.
 */

import { jest } from "@jest/globals";
import { DnsContext } from "../../src/core/context.js";
import { RCODE, RRType } from "../../src/core/types.js";

// Mock implementations of required browser APIs
global.atob = jest.fn((str) => Buffer.from(str, "base64").toString("binary"));
global.Response = jest.fn(function (body, init) {
  this.body = body;
  this.status = init?.status || 200;
  this.headers = new Map(Object.entries(init?.headers || {}));
});

describe("DNS Context Creation", () => {
  let mockRequest;
  let mockDnsBuffer;

  beforeEach(() => {
    // Mock Request object
    mockRequest = {
      method: "POST",
      url: "https://example.com/dns-query",
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(10)),
    };

    // Create a simple DNS buffer
    mockDnsBuffer = new ArrayBuffer(10);
    const view = new DataView(mockDnsBuffer);
    view.setUint16(0, 1234); // Set a transaction ID
  });

  test("should create context from POST request", async () => {
    mockRequest.arrayBuffer.mockResolvedValue(mockDnsBuffer);

    const ctx = await DnsContext.fromRequest(mockRequest);

    expect(ctx).toBeInstanceOf(DnsContext);
    expect(ctx.request).toBe(mockRequest);
    expect(ctx.dnsMessage).toBe(mockDnsBuffer);
    expect(ctx.resolved).toBe(false);
    expect(ctx.metadata.tags).toEqual([]);
  });

  test("should create context from GET request with dns parameter", async () => {
    // Mock GET request with dns parameter
    const base64Dns = "AAABAAAAAAAAAAAAAAAAAAA="; // Simple base64 DNS message
    mockRequest.method = "GET";
    mockRequest.url = `https://example.com/dns-query?dns=${base64Dns}`;

    // Mock URL constructor
    global.URL = jest.fn(() => ({
      searchParams: {
        get: jest.fn().mockReturnValue(base64Dns),
      },
    }));

    const ctx = await DnsContext.fromRequest(mockRequest);

    expect(ctx).toBeInstanceOf(DnsContext);
    expect(atob).toHaveBeenCalled();
  });

  test("should return null for invalid requests", async () => {
    // Missing dns parameter in GET request
    mockRequest.method = "GET";
    mockRequest.url = "https://example.com/dns-query";

    global.URL = jest.fn(() => ({
      searchParams: {
        get: jest.fn().mockReturnValue(null),
      },
    }));

    const ctx = await DnsContext.fromRequest(mockRequest);
    expect(ctx).toBeNull();
  });

  test("should create context from JSON request", async () => {
    mockRequest.json = jest.fn().mockResolvedValue({
      name: "example.com",
      type: RRType.A,
    });

    const ctx = await DnsContext.fromJsonRequest(mockRequest);

    expect(ctx).toBeInstanceOf(DnsContext);
    expect(ctx.jsonQuery.name).toBe("example.com");
    expect(ctx.jsonQuery.type).toBe(RRType.A);
  });

  test("should return null for invalid JSON requests", async () => {
    mockRequest.json = jest.fn().mockResolvedValue({ invalid: "data" });

    const ctx = await DnsContext.fromJsonRequest(mockRequest);
    expect(ctx).toBeNull();
  });
});

describe("DNS Context Methods", () => {
  let ctx;

  beforeEach(() => {
    // Create a basic context
    ctx = new DnsContext(
      { method: "POST", url: "https://example.com/dns-query" },
      new ArrayBuffer(10)
    );
  });

  test("getQueryDomain should return appropriate domain", () => {
    // Test with JSON query
    ctx.jsonQuery = { name: "test.example.com" };
    expect(ctx.getQueryDomain()).toBe("test.example.com");

    // Test without JSON query (should return default)
    ctx.jsonQuery = null;
    expect(ctx.getQueryDomain()).toBe("example.com");
  });

  test("getQueryType should return appropriate type", () => {
    // Test with JSON query with type
    ctx.jsonQuery = { name: "example.com", type: RRType.AAAA };
    expect(ctx.getQueryType()).toBe(RRType.AAAA);

    // Test with JSON query without type (should default to A)
    ctx.jsonQuery = { name: "example.com" };
    expect(ctx.getQueryType()).toBe(RRType.A);

    // Test without JSON query (should return default)
    ctx.jsonQuery = null;
    expect(ctx.getQueryType()).toBe(RRType.A);
  });

  test("setResponse should update context state", () => {
    const response = new ArrayBuffer(20);
    ctx.setResponse(response);

    expect(ctx.response).toBe(response);
    expect(ctx.resolved).toBe(true);
  });

  test("setError should store error code", () => {
    ctx.setError(RCODE.REFUSED);
    expect(ctx.error).toBe(RCODE.REFUSED);
  });

  test("addTag and hasTag should manage tags", () => {
    // Start with no tags
    expect(ctx.hasTag("test")).toBe(false);

    // Add a tag
    ctx.addTag("test");
    expect(ctx.hasTag("test")).toBe(true);

    // Add another tag
    ctx.addTag("another");
    expect(ctx.hasTag("another")).toBe(true);
    expect(ctx.metadata.tags).toContain("test");
    expect(ctx.metadata.tags).toContain("another");
  });

  test("buildResponse should return appropriate response based on context state", () => {
    // Test with unresolved context
    expect(ctx.resolved).toBe(false);
    let response = ctx.buildResponse();
    expect(response.status).toBe(500);

    // Test with error set but not marked as resolved
    ctx.setError(RCODE.NXDOMAIN);
    // We need to set resolved to true for error response to be returned
    ctx.resolved = false;
    response = ctx.buildResponse();
    expect(response.status).toBe(500); // Still 500 because not resolved

    // Test with error set and marked as resolved
    ctx.resolved = true;
    response = ctx.buildResponse();
    expect(response.status).toBe(502);

    // Test with successful response
    const dnsResponse = new ArrayBuffer(20);
    ctx.error = null; // Clear the error
    ctx.setResponse(dnsResponse);
    response = ctx.buildResponse();
    expect(response.status).toBe(200);
    expect(response.body).toBe(dnsResponse);
    expect(response.headers.get("Content-Type")).toBe(
      "application/dns-message"
    );
    expect(response.headers.get("Cache-Control")).toBe("max-age=300");
  });
});
