/**
 * Encoding Utilities
 *
 * Provides utilities for encoding and decoding data formats used in DNS.
 */

/**
 * Convert ArrayBuffer to Base64Url string
 *
 * @param {ArrayBuffer} buffer - The buffer to encode
 * @returns {string} Base64Url encoded string
 */
export function arrayBufferToBase64Url(buffer) {
  // Convert to regular base64
  const binary = String.fromCharCode(...new Uint8Array(buffer));
  const base64 = btoa(binary);

  // Convert to base64url
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Convert Base64Url string to ArrayBuffer
 *
 * @param {string} base64url - Base64Url encoded string
 * @returns {ArrayBuffer} Decoded data
 */
export function base64UrlToArrayBuffer(base64url) {
  // Convert Base64URL to Base64
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");

  // Pad with = if necessary
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const padded = base64 + padding;

  // Decode Base64 to binary string
  const binaryString = atob(padded);

  // Convert binary string to ArrayBuffer
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
}

/**
 * Hex encode a buffer
 *
 * @param {ArrayBuffer} buffer - The buffer to encode
 * @returns {string} Hex encoded string
 */
export function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convert hex string to ArrayBuffer
 *
 * @param {string} hex - Hex encoded string
 * @returns {ArrayBuffer} Decoded data
 */
export function hexToBuffer(hex) {
  if (hex.length % 2 !== 0) {
    throw new Error("Hex string must have an even number of characters");
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }

  return bytes.buffer;
}
