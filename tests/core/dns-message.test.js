/**
 * Unit tests for DNS message parsing
 */

import { jest } from "@jest/globals";
import {
  parseDnsQuery,
  buildDnsResponse,
  arrayBufferToBase64Url,
  parseDnsResponse,
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

  // Helper to create a simple DNS response buffer with A record
  const createDnsResponseBuffer = (
    domain = "example.com",
    ip = "93.184.216.34"
  ) => {
    const ipParts = ip.split(".").map((p) => parseInt(p, 10));

    // Calculate the exact size needed
    const domainEncoded =
      domain
        .split(".")
        .map((part) => part.length + 1 + part.length)
        .reduce((a, b) => a + b, 0) + 1;
    const questionSize = domainEncoded + 4; // domain name + qtype + qclass
    const answerSize = 2 + 2 + 2 + 4 + 2 + 4; // pointer + type + class + ttl + rdlength + ipv4
    const bufferSize = 12 + questionSize + answerSize; // header + question + answer

    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);

    // Header
    view.setUint16(0, 1234); // ID
    view.setUint16(2, 0x8180); // Flags: response, recursion desired, recursion available
    view.setUint16(4, 1); // QDCOUNT: 1 question
    view.setUint16(6, 1); // ANCOUNT: 1 answer
    view.setUint16(8, 0); // NSCOUNT: 0 authority records
    view.setUint16(10, 0); // ARCOUNT: 0 additional records

    // Question section - domain name
    let offset = 12;
    const parts = domain.split(".");
    for (const part of parts) {
      view.setUint8(offset++, part.length);
      for (let i = 0; i < part.length; i++) {
        view.setUint8(offset++, part.charCodeAt(i));
      }
    }
    view.setUint8(offset++, 0); // Terminator for domain name

    // Question type and class
    view.setUint16(offset, RRType.A); // QTYPE: A record
    offset += 2;
    view.setUint16(offset, 1); // QCLASS: IN (Internet)
    offset += 2;

    // Answer section - name is a pointer to the question
    view.setUint16(offset, 0xc00c); // Pointer to the domain name in the question (offset 12)
    offset += 2;

    view.setUint16(offset, RRType.A); // TYPE: A record
    offset += 2;

    view.setUint16(offset, 1); // CLASS: IN (Internet)
    offset += 2;

    view.setUint32(offset, 300); // TTL: 300 seconds
    offset += 4;

    view.setUint16(offset, 4); // RDLENGTH: 4 bytes for IPv4 address
    offset += 2;

    // RDATA: IPv4 address
    for (let i = 0; i < ipParts.length; i++) {
      if (offset < buffer.byteLength) {
        view.setUint8(offset++, ipParts[i]);
      }
    }

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

  test("parseDnsResponse parses A record response correctly", () => {
    const responseBuffer = createDnsResponseBuffer(
      "example.com",
      "93.184.216.34"
    );

    // Log the buffer details for debugging
    const view = new DataView(responseBuffer);
    const headerFlags = view.getUint16(2);
    const qdcount = view.getUint16(4);
    const ancount = view.getUint16(6);

    // Check that the response buffer looks valid before parsing
    expect(headerFlags & 0x8000).not.toBe(0); // QR bit should be set
    expect(qdcount).toBe(1); // Should have 1 question
    expect(ancount).toBe(1); // Should have 1 answer

    const result = parseDnsResponse(responseBuffer);

    // Verify response parsed correctly
    expect(result.rcode).toBe(RCODE.NOERROR);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].name).toBe("example.com");
    expect(result.questions[0].type).toBe(RRType.A);

    expect(result.answers).toHaveLength(1);
    expect(result.answers[0].type).toBe(RRType.A);
    expect(result.answers[0].ttl).toBe(300);
    expect(result.answers[0].data).toBe("93.184.216.34");
  });

  test("parseDnsResponse handles invalid input gracefully", () => {
    // Test with null buffer
    const result1 = parseDnsResponse(null);
    expect(result1.rcode).toBe(RCODE.SERVFAIL);
    expect(result1.answers).toHaveLength(0);

    // Test with non-ArrayBuffer
    const result2 = parseDnsResponse("not a buffer");
    expect(result2.rcode).toBe(RCODE.SERVFAIL);
    expect(result2.answers).toHaveLength(0);

    // Test with too small buffer
    const tooSmall = new ArrayBuffer(5);
    const result3 = parseDnsResponse(tooSmall);
    expect(result3.rcode).toBe(RCODE.SERVFAIL);
  });
});
