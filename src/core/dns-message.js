/**
 * DNS Message Parser and Builder
 *
 * Provides functionality to parse and build DNS wire format messages
 * for use with DNS over HTTPS (DoH) protocol.
 */

import { RRType, RCODE } from "./types";

/**
 * Parse a DNS query message from wire format
 *
 * @param {ArrayBuffer|string} data - DNS message in wire format or base64url encoded
 * @param {boolean} isBase64 - Whether the data is base64url encoded
 * @returns {Object} Parsed DNS message object
 */
export async function parseDnsQuery(data, isBase64 = false) {
  try {
    let buffer;

    if (isBase64) {
      // Convert base64url to ArrayBuffer
      buffer = base64ToArrayBuffer(data);
    } else if (data instanceof ArrayBuffer) {
      buffer = data;
    } else {
      throw new Error("Invalid DNS message format");
    }

    // Create a DataView for easier binary parsing
    const view = new DataView(buffer);

    // Parse DNS header
    const header = {
      id: view.getUint16(0),
      flags: view.getUint16(2),
      qdcount: view.getUint16(4),
      ancount: view.getUint16(6),
      nscount: view.getUint16(8),
      arcount: view.getUint16(10),
    };

    // Parse questions (we only need basic info for routing)
    let offset = 12; // Start of question section
    const questions = [];

    for (let i = 0; i < header.qdcount; i++) {
      const { name, bytesRead } = parseDomainName(buffer, offset);
      offset += bytesRead;

      const qtype = view.getUint16(offset);
      offset += 2;

      const qclass = view.getUint16(offset);
      offset += 2;

      questions.push({
        name,
        type: qtype,
        class: qclass,
      });
    }

    return {
      header,
      questions,
      buffer, // Keep original buffer for forwarding
    };
  } catch (error) {
    console.error("Failed to parse DNS query:", error);
    throw error;
  }
}

/**
 * Parse a domain name from DNS wire format
 *
 * @param {ArrayBuffer} buffer - DNS message buffer
 * @param {number} offset - Start offset in the buffer
 * @returns {Object} Object containing the domain name and bytes read
 */
function parseDomainName(buffer, offset) {
  const view = new DataView(buffer);
  let currentOffset = offset;
  let name = "";
  let bytesRead = 0;

  while (true) {
    const length = view.getUint8(currentOffset);
    currentOffset++;
    bytesRead++;

    // End of domain name
    if (length === 0) {
      break;
    }

    // Handle pointer to a previously mentioned domain name
    if ((length & 0xc0) === 0xc0) {
      // This is a pointer - extract offset
      const pointerOffset =
        ((length & 0x3f) << 8) | view.getUint8(currentOffset);
      currentOffset++;
      bytesRead++;

      // We don't handle compressed names in this simple implementation
      // In a real implementation, we would recurse and parse the name at pointerOffset
      name += "[compressed]";
      break;
    }

    // Regular label
    if (name.length > 0) {
      name += ".";
    }

    // Extract the label
    for (let i = 0; i < length; i++) {
      name += String.fromCharCode(view.getUint8(currentOffset));
      currentOffset++;
      bytesRead++;
    }
  }

  return { name, bytesRead };
}

/**
 * Parse a DNS response message from wire format
 *
 * @param {ArrayBuffer} buffer - The DNS response buffer
 * @returns {Object} - Parsed DNS response object
 */
export function parseDnsResponse(buffer) {
  // Default error response
  const errorResponse = {
    header: 0,
    flags: 0,
    rcode: RCODE.SERVFAIL,
    questions: [],
    answers: [],
  };

  // Input validation
  if (!buffer || !(buffer instanceof ArrayBuffer)) {
    console.error("Failed to parse DNS response: Invalid input type");
    return errorResponse;
  }

  // Check minimum size (at least DNS header size of 12 bytes)
  if (buffer.byteLength < 12) {
    console.error("Failed to parse DNS response: Invalid DNS response format");
    return errorResponse;
  }

  try {
    const view = new DataView(buffer);
    const header = {
      id: view.getUint16(0),
      flags: view.getUint16(2),
      qdcount: view.getUint16(4),
      ancount: view.getUint16(6),
      nscount: view.getUint16(8),
      arcount: view.getUint16(10),
    };

    // Extract response code (bottom 4 bits of flags)
    const rcode = header.flags & 0x000f;

    // Parse questions
    let offset = 12; // Start after header
    const questions = [];
    for (let i = 0; i < header.qdcount; i++) {
      const { name, bytesRead } = parseDomainName(buffer, offset);
      offset += bytesRead;

      // Ensure we have enough bytes for type and class (4 bytes)
      if (offset + 4 > buffer.byteLength) {
        throw new Error("Buffer too small for question type and class");
      }

      const type = view.getUint16(offset);
      offset += 2;
      const qclass = view.getUint16(offset);
      offset += 2;

      questions.push({ name, type, class: qclass });
    }

    // Parse answers
    const answers = [];
    for (let i = 0; i < header.ancount; i++) {
      // Parse answer name
      const { name, bytesRead } = parseDomainName(buffer, offset);
      offset += bytesRead;

      // Ensure we have enough bytes for the rest of the record
      if (offset + 10 > buffer.byteLength) {
        // type(2) + class(2) + ttl(4) + rdlength(2)
        throw new Error("Buffer too small for answer record");
      }

      // Parse record type, class, TTL, and data length
      const type = view.getUint16(offset);
      offset += 2;
      const aclass = view.getUint16(offset);
      offset += 2;
      const ttl = view.getUint32(offset);
      offset += 4;
      const rdlength = view.getUint16(offset);
      offset += 2;

      // Ensure we have enough bytes for the record data
      if (offset + rdlength > buffer.byteLength) {
        throw new Error("Buffer too small for record data");
      }

      // Parse record data based on type
      let data;
      switch (type) {
        case RRType.A:
          if (rdlength === 4) {
            data = `${view.getUint8(offset)}.${view.getUint8(
              offset + 1
            )}.${view.getUint8(offset + 2)}.${view.getUint8(offset + 3)}`;
          }
          break;
        case RRType.AAAA:
          if (rdlength === 16) {
            // Format IPv6 address
            let ipv6 = "";
            for (let j = 0; j < 16; j += 2) {
              if (j > 0) ipv6 += ":";
              ipv6 +=
                view
                  .getUint8(offset + j)
                  .toString(16)
                  .padStart(2, "0") +
                view
                  .getUint8(offset + j + 1)
                  .toString(16)
                  .padStart(2, "0");
            }
            data = ipv6;
          }
          break;
        case RRType.CNAME:
        case RRType.NS:
        case RRType.PTR:
          const domainResult = parseDomainName(buffer, offset);
          data = domainResult.name;
          break;
        case RRType.MX:
          const preference = view.getUint16(offset);
          const mxDomainResult = parseDomainName(buffer, offset + 2);
          data = `${preference} ${mxDomainResult.name}`;
          break;
        case RRType.TXT:
          // TXT records consist of one or more strings
          let txtOffset = offset;
          let txtData = "";
          while (txtOffset < offset + rdlength) {
            const strLength = view.getUint8(txtOffset);
            txtOffset++;

            // Extract the string
            let str = "";
            for (
              let j = 0;
              j < strLength && txtOffset < offset + rdlength;
              j++
            ) {
              str += String.fromCharCode(view.getUint8(txtOffset));
              txtOffset++;
            }

            txtData += (txtData ? " " : "") + str;
          }
          data = txtData;
          break;
        default:
          // For unsupported record types, return hex string
          data =
            "0x" +
            Array.from(new Uint8Array(buffer.slice(offset, offset + rdlength)))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");
      }

      answers.push({
        name,
        type,
        class: aclass,
        ttl,
        data,
      });

      offset += rdlength;
    }

    return {
      header: header.id,
      flags: header.flags,
      rcode,
      questions,
      answers,
    };
  } catch (error) {
    console.error("Failed to parse DNS response:", error);
    return errorResponse;
  }
}

/**
 * Build a DNS response message
 *
 * @param {Object} query - Original DNS query object
 * @param {Object} options - Response options (rcode, answers, etc.)
 * @returns {ArrayBuffer} DNS response in wire format
 */
export function buildDnsResponse(query, options = {}) {
  // In a real implementation, we would build a proper DNS response
  // For now, we'll just return the original response if available
  if (options.raw) {
    return options.raw;
  }

  // If we need to generate an error response, we'd do it here
  // This is a basic implementation that would set the appropriate
  // RCODE in the DNS header

  const buffer = new ArrayBuffer(query.buffer.byteLength);
  new Uint8Array(buffer).set(new Uint8Array(query.buffer));

  // Set response bit and RCODE
  const view = new DataView(buffer);
  let flags = view.getUint16(2);
  flags |= 0x8000; // Set QR bit (response)
  flags &= 0xfff0; // Clear RCODE bits
  flags |= (options.rcode || RCODE.NOERROR) & 0x0f; // Set RCODE

  view.setUint16(2, flags);

  return buffer;
}

/**
 * Convert a base64url encoded string to an ArrayBuffer
 *
 * @param {string} base64Url - Base64url encoded string
 * @returns {ArrayBuffer} Decoded data as ArrayBuffer
 */
function base64ToArrayBuffer(base64Url) {
  // Convert base64url to base64
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");

  // Decode base64 to a binary string
  const binaryString = atob(base64);

  // Create an ArrayBuffer from the binary string
  const len = binaryString.length;
  const bytes = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
}

/**
 * Convert an ArrayBuffer to a base64url encoded string
 *
 * @param {ArrayBuffer} buffer - ArrayBuffer to encode
 * @returns {string} Base64url encoded string
 */
export function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  // Convert binary string to base64
  const base64 = btoa(binary);

  // Convert base64 to base64url
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Parse a DNS query from JSON format (for application/dns-json)
 *
 * @param {string} url - Request URL containing DNS query parameters
 * @returns {Object} Parsed DNS query object
 */
export function parseDnsQueryFromJson(url) {
  const params = new URL(url).searchParams;
  const name = params.get("name");
  const type = params.get("type") || "A";

  if (!name) {
    throw new Error("Missing required parameter: name");
  }

  // Create a minimal DNS query object
  const typeValue =
    typeof type === "string"
      ? RRType[type.toUpperCase()] || RRType.A
      : parseInt(type) || RRType.A;

  // Create a fake wire format query for consistency
  const buffer = new ArrayBuffer(12 + name.length + 6); // Basic header + name + type/class
  const view = new DataView(buffer);

  // Set ID and flags
  view.setUint16(0, Math.floor(Math.random() * 65535)); // Random ID
  view.setUint16(2, 0x0100); // Standard query
  view.setUint16(4, 1); // QDCOUNT = 1
  view.setUint16(6, 0); // ANCOUNT = 0
  view.setUint16(8, 0); // NSCOUNT = 0
  view.setUint16(10, 0); // ARCOUNT = 0

  // Very simple domain name encoding (not handling dots properly)
  let offset = 12;
  const parts = name.split(".");

  for (const part of parts) {
    view.setUint8(offset++, part.length);

    for (let i = 0; i < part.length; i++) {
      view.setUint8(offset++, part.charCodeAt(i));
    }
  }

  view.setUint8(offset++, 0); // Terminator
  view.setUint16(offset, typeValue); // QTYPE
  offset += 2;
  view.setUint16(offset, 1); // QCLASS = IN

  return {
    header: {
      id: view.getUint16(0),
      flags: view.getUint16(2),
      qdcount: 1,
      ancount: 0,
      nscount: 0,
      arcount: 0,
    },
    questions: [
      {
        name,
        type: typeValue,
        class: 1,
      },
    ],
    buffer: buffer,
  };
}
