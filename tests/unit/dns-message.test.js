/**
 * Unit tests for DNS message parsing
 */

import { jest } from "@jest/globals";
import {
  parseDnsQuery,
  buildDnsResponse,
  arrayBufferToBase64Url,
} from "../../src/core/dns-message.js";
import { RRType, RCODE } from "../../src/core/types.js";

// Mock implementation of btoa for tests
global.btoa = (str) => Buffer.from(str, "binary").toString("base64");
global.atob = (b64) => Buffer.from(b64, "base64").toString("binary");

describe("DNS Message Parser", () => {
  // Helper to create a simple DNS query buffer
  const createDnsQueryBuffer = (domain = "example.com", type = RRType.A) => {
    const buffer = new ArrayBuffer(12 + domain.length + 2 + 2 + 2);
    const view = new DataView(buffer);

    // ID: 1234
    view.setUint16(0, 1234);

    // Flags: Standard query
    view.setUint16(2, 0x0100);

    // QDCOUNT: 1
    view.setUint16(4, 1);

    // ANCOUNT, NSCOUNT, ARCOUNT: 0
    view.setUint16(6, 0);
    view.setUint16(8, 0);
    view.setUint16(10, 0);

    // Domain name
    let offset = 12;
    const parts = domain.split(".");
    for (const part of parts) {
      view.setUint8(offset++, part.length);
      for (let i = 0; i < part.length; i++) {
        view.setUint8(offset++, part.charCodeAt(i));
      }
    }
    view.setUint8(offset++, 0); // Root label

    // QTYPE
    view.setUint16(offset, type);
    offset += 2;

    // QCLASS: IN
    view.setUint16(offset, 1);

    return buffer;
  };

  test("parseDnsQuery parses a simple query correctly", async () => {
    const queryBuffer = createDnsQueryBuffer("example.com", RRType.A);
    const result = await parseDnsQuery(queryBuffer);

    expect(result).toBeDefined();
    expect(result.header).toBeDefined();
    expect(result.header.id).toBe(1234);
    expect(result.header.qdcount).toBe(1);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].name).toBe("example.com");
    expect(result.questions[0].type).toBe(RRType.A);
    expect(result.questions[0].class).toBe(1);
  });

  test("parseDnsQuery handles base64 encoded queries", async () => {
    const queryBuffer = createDnsQueryBuffer("example.org", RRType.AAAA);
    const base64Query = arrayBufferToBase64Url(queryBuffer);

    const result = await parseDnsQuery(base64Query, true);

    expect(result).toBeDefined();
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].name).toBe("example.org");
    expect(result.questions[0].type).toBe(RRType.AAAA);
  });

  test("buildDnsResponse creates a proper response", () => {
    const queryBuffer = createDnsQueryBuffer("example.net", RRType.A);
    const query = {
      header: {
        id: 1234,
        flags: 0x0100,
        qdcount: 1,
      },
      questions: [{ name: "example.net", type: RRType.A, class: 1 }],
      buffer: queryBuffer,
    };

    const response = buildDnsResponse(query, { rcode: RCODE.NXDOMAIN });

    // Verify it's a response
    const view = new DataView(response);
    const flags = view.getUint16(2);

    // Check QR bit is set (response)
    expect((flags & 0x8000) !== 0).toBe(true);

    // Check RCODE is set
    expect(flags & 0x000f).toBe(RCODE.NXDOMAIN);
  });
});
