/**
 * DNS Builder Helper Tests
 *
 * Tests the functionality of the DNS Builder helper utilities and
 * verifies they can be used to construct valid DNS queries for DoH servers.
 */

import { jest } from "@jest/globals";
import { RRType } from "../../src/core/types.js";
import {
  createDnsQueryBuffer,
  createDnsQuery,
  createDnsResponse,
  arrayBufferToBase64Url,
  createMockDnsContext,
} from "./dns-builder.js";

// Mock fetch API for testing external DoH queries
global.fetch = jest.fn();

// Set up Response constructor mock
global.Response = jest.fn(function (body, init) {
  this.body = body;
  this.status = init?.status || 200;
  this.headers = new Map(Object.entries(init?.headers || {}));
  this.arrayBuffer = jest.fn().mockResolvedValue(body);
  this.ok = this.status >= 200 && this.status < 300;
});

describe("DNS Builder Utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("createDnsQueryBuffer should create valid DNS query buffer", () => {
    // Create a DNS query buffer for example.com
    const buffer = createDnsQueryBuffer("example.com", RRType.A, 1234);

    // Verify buffer is an ArrayBuffer
    expect(buffer).toBeInstanceOf(ArrayBuffer);

    // Verify buffer length (12 bytes header + domain length with dots replaced by length bytes + 4 bytes for type and class)
    const expectedLength = 12 + "example.com".length + 2 + 4; // +2 for length bytes
    expect(buffer.byteLength).toBe(expectedLength);

    // Verify content by creating a DataView
    const view = new DataView(buffer);

    // Verify DNS ID
    expect(view.getUint16(0)).toBe(1234);

    // Verify flags (standard query: recursion desired)
    expect(view.getUint16(2)).toBe(0x0100);

    // Verify question count
    expect(view.getUint16(4)).toBe(1);
  });

  test("createDnsQuery should create structured DNS query object", () => {
    // Create query for example.com
    const query = createDnsQuery("example.com", RRType.A);

    // Verify structure
    expect(query.header).toBeDefined();
    expect(query.header.id).toBe(1234);
    expect(query.header.flags.rd).toBe(true);
    expect(query.questions).toHaveLength(1);
    expect(query.questions[0].name).toBe("example.com");
    expect(query.questions[0].type).toBe(RRType.A);
    expect(query.buffer).toBeInstanceOf(ArrayBuffer);
  });

  test("arrayBufferToBase64Url should correctly encode binary data", () => {
    // Create a simple buffer with known content
    const buffer = new Uint8Array([1, 2, 3, 4, 5, 6]).buffer;

    // Manual base64url encoding for comparison: AQIDBAUG
    // (note: removed padding and replaced + with - and / with _)
    const expected = "AQIDBAUG";

    // Test encoding
    const encoded = arrayBufferToBase64Url(buffer);
    expect(encoded).toBe(expected);
  });

  test("createMockDnsContext should create context with required properties", () => {
    // Create context for test.example.com
    const ctx = createMockDnsContext("test.example.com", RRType.AAAA);

    // Verify context has required methods and properties
    expect(ctx.getQueryDomain()).toBe("test.example.com");
    expect(ctx.getQueryType()).toBe(RRType.AAAA);
    expect(typeof ctx.setResponse).toBe("function");
    expect(typeof ctx.setError).toBe("function");
    expect(typeof ctx.addTag).toBe("function");
    expect(typeof ctx.hasTag).toBe("function");
    expect(ctx.metadata).toBeDefined();
    expect(ctx.metadata.tags).toEqual([]);
    expect(ctx.resolved).toBe(false);
  });

  test("createDnsResponse should create proper response object", () => {
    // Create query for example.com
    const query = createDnsQuery("example.com", RRType.A);

    // Create answer records
    const answers = [
      {
        name: "example.com",
        type: RRType.A,
        class: 1,
        ttl: 300,
        rdata: "93.184.216.34",
      },
    ];

    // Create response
    const response = createDnsResponse(query, answers, 0);

    // Verify response structure
    expect(response.header.id).toBe(query.header.id);
    expect(response.header.flags.qr).toBe(true);
    expect(response.header.flags.rcode).toBe(0);
    expect(response.questions).toEqual(query.questions);
    expect(response.answers).toEqual(answers);
  });
});

describe("DoH Queries with DNS Builder", () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup fetch mock with successful response
    global.fetch.mockImplementation(async () => {
      // Create a dummy DNS response buffer
      const responseBuffer = new Uint8Array([
        // Header (ID: 1234, Flags: 0x8180, QDCount: 1, ANCount: 1, NSCount: 0, ARCount: 0)
        0x04,
        0xd2, 0x81, 0x80, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
        // Question section (example.com, A record)
        0x07, 0x65, 0x78, 0x61, 0x6d, 0x70, 0x6c, 0x65, 0x03, 0x63, 0x6f, 0x6d,
        0x00, 0x00, 0x01, 0x00, 0x01,
        // Answer section (example.com, A record, TTL: 300, IP: 93.184.216.34)
        0xc0, 0x0c, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x01, 0x2c, 0x00, 0x04,
        0x5d, 0xb8, 0xd8, 0x22,
      ]).buffer;

      return new Response(responseBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/dns-message",
        },
      });
    });
  });

  test("should send GET request to https://doh.pub/dns-query", async () => {
    // Create DNS query for baidu.com
    const queryBuffer = createDnsQueryBuffer("baidu.com", RRType.A, 1234);

    // Encode as base64url for GET request
    const dnsParam = arrayBufferToBase64Url(queryBuffer);

    // Construct DoH GET URL
    const url = `https://doh.pub/dns-query?dns=${dnsParam}`;

    // Send request
    const response = await fetch(url, {
      headers: {
        Accept: "application/dns-message",
      },
    });

    // Verify fetch was called correctly
    expect(fetch).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/dns-message",
        }),
      })
    );

    // Verify response
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/dns-message"
    );

    // Get binary response
    const responseBuffer = await response.arrayBuffer();
    expect(responseBuffer).toBeTruthy();
  });

  test("should send POST request to https://doh.pub/dns-query", async () => {
    // Create DNS query for qq.com
    const queryBuffer = createDnsQueryBuffer("qq.com", RRType.A, 1234);

    // Send POST request
    const response = await fetch("https://doh.pub/dns-query", {
      method: "POST",
      headers: {
        "Content-Type": "application/dns-message",
        Accept: "application/dns-message",
      },
      body: queryBuffer,
    });

    // Verify fetch was called correctly
    expect(fetch).toHaveBeenCalledWith("https://doh.pub/dns-query", {
      method: "POST",
      headers: {
        "Content-Type": "application/dns-message",
        Accept: "application/dns-message",
      },
      body: queryBuffer,
    });

    // Verify response
    expect(response.status).toBe(200);

    // Get binary response
    const responseBuffer = await response.arrayBuffer();
    expect(responseBuffer).toBeTruthy();
  });
});
