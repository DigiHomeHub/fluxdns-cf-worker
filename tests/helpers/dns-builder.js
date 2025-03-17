/**
 * DNS Message Builder Helper
 *
 * Provides utilities for creating DNS queries and responses for testing.
 */

import { RRType } from "../../src/core/types.js";

/**
 * Creates a simple DNS query buffer
 *
 * @param {string} domain - Domain name to query
 * @param {number} type - DNS record type
 * @param {number} id - DNS message ID
 * @returns {ArrayBuffer} DNS query binary data
 */
export function createDnsQueryBuffer(
  domain = "example.com",
  type = RRType.A,
  id = 1234
) {
  // Build simple DNS query binary message
  const buffer = new ArrayBuffer(12 + domain.length + 6); // Basic header + domain + type and class
  const view = new DataView(buffer);

  // Set DNS message ID
  view.setUint16(0, id);

  // Set flags (standard query)
  view.setUint16(2, 0x0100);

  // Set question count to 1
  view.setUint16(4, 1);

  // Set other counts to 0
  view.setUint16(6, 0); // Answer count
  view.setUint16(8, 0); // Authority count
  view.setUint16(10, 0); // Additional count

  // Add domain name query
  let offset = 12;
  const parts = domain.split(".");
  for (const part of parts) {
    view.setUint8(offset++, part.length);
    for (let i = 0; i < part.length; i++) {
      view.setUint8(offset++, part.charCodeAt(i));
    }
  }

  // End domain with 0
  view.setUint8(offset++, 0);

  // Set query type
  view.setUint16(offset, type);
  offset += 2;

  // Set query class (IN)
  view.setUint16(offset, 1);

  return buffer;
}

/**
 * Creates a DNS query object
 *
 * @param {string} domain - Domain to query
 * @param {number} type - DNS record type
 * @returns {Object} DNS query object
 */
export function createDnsQuery(domain = "example.com", type = RRType.A) {
  const buffer = createDnsQueryBuffer(domain, type);

  return {
    header: {
      id: 1234,
      flags: { qr: false, rd: true },
      qdcount: 1,
      ancount: 0,
      nscount: 0,
      arcount: 0,
    },
    questions: [
      {
        name: domain,
        type: type,
        class: 1,
      },
    ],
    answers: [],
    authorities: [],
    additionals: [],
    buffer: buffer,
  };
}

/**
 * Creates a DNS response object
 *
 * @param {Object} query - DNS query object
 * @param {Array} answers - Answer records
 * @param {number} rcode - Response code
 * @returns {Object} DNS response object
 */
export function createDnsResponse(query, answers = [], rcode = 0) {
  return {
    header: {
      id: query.header.id,
      flags: { qr: true, rd: true, ra: true, rcode: rcode },
      qdcount: query.questions.length,
      ancount: answers.length,
      nscount: 0,
      arcount: 0,
    },
    questions: query.questions,
    answers: answers,
    authorities: [],
    additionals: [],
  };
}

/**
 * Convert ArrayBuffer to Base64Url string
 *
 * @param {ArrayBuffer} buffer - The buffer to encode
 * @returns {string} Base64Url encoded string
 */
export function arrayBufferToBase64Url(buffer) {
  // Convert to regular base64
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  // Convert to base64url
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Creates a mock DNS context for testing
 *
 * @param {string} domain - Domain name
 * @param {number} type - DNS record type
 * @returns {Object} Mock DNS context
 */
export function createMockDnsContext(domain, type = RRType.A) {
  return {
    query: {
      id: 1234,
      flags: { rd: true },
      questions: [
        {
          name: domain,
          type: type,
          class: 1,
        },
      ],
    },
    getQueryDomain: function () {
      return domain;
    },
    getQueryType: function () {
      return type;
    },
    setResponse: function () {},
    setError: function () {},
    addTag: function () {},
    hasTag: function () {
      return false;
    },
    metadata: {
      tags: [],
      timings: {},
      errors: [],
    },
    resolved: false,
    response: null,
    buildResponse: function () {},
  };
}
