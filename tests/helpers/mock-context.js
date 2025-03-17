/**
 * Mock DNS Context Helpers
 *
 * Provides utilities for creating mock DNS contexts for testing.
 */

import { jest } from "@jest/globals";
import { RRType } from "../../src/core/types.js";

/**
 * Creates a mock DNS context for testing
 *
 * @param {string} domain - Domain name
 * @param {number} type - DNS record type (default: A record)
 * @returns {Object} Mock DNS context with jest spy methods
 */
export function createMockDnsContext(domain, type = RRType.A) {
  return {
    domain,
    type,
    resolved: false,
    error: null,
    response: null,
    metadata: {
      tags: [],
      timings: {},
      errors: [],
    },
    getQueryDomain: jest.fn().mockReturnValue(domain),
    getQueryType: jest.fn().mockReturnValue(type),
    setResponse: jest.fn(function (response) {
      this.response = response;
      this.resolved = true;
    }),
    setError: jest.fn(function (rcode) {
      this.error = rcode;
    }),
    addTag: jest.fn(function (tag) {
      this.metadata.tags = this.metadata.tags || [];
      this.metadata.tags.push(tag);
    }),
    hasTag: jest.fn(function (tag) {
      return this.metadata.tags && this.metadata.tags.includes(tag);
    }),
    buildResponse: jest.fn().mockReturnValue(new ArrayBuffer(10)),
  };
}
