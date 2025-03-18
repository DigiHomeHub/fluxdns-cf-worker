/**
 * Unit tests for DNS Type Definitions
 *
 * These tests verify the correctness of DNS type definitions
 * used throughout the application.
 */

import { jest } from "@jest/globals";
import { RRType, RCODE, PluginStatus } from "../../src/core/types.js";

describe("DNS Type Definitions", () => {
  describe("RRType Constants", () => {
    test("should define correct DNS record types", () => {
      // Verify common record types
      expect(RRType.A).toBe(1);
      expect(RRType.NS).toBe(2);
      expect(RRType.CNAME).toBe(5);
      expect(RRType.SOA).toBe(6);
      expect(RRType.PTR).toBe(12);
      expect(RRType.MX).toBe(15);
      expect(RRType.TXT).toBe(16);
      expect(RRType.AAAA).toBe(28);
      expect(RRType.SRV).toBe(33);
      expect(RRType.OPT).toBe(41);
      expect(RRType.ANY).toBe(255);
    });

    test("should have no overlapping record type codes", () => {
      // Get all values from RRType
      const values = Object.values(RRType);

      // Check for duplicates by comparing array length with Set size
      expect(values.length).toBe(new Set(values).size);
    });
  });

  describe("RCODE Constants", () => {
    test("should define correct DNS response codes", () => {
      // Verify common response codes
      expect(RCODE.NOERROR).toBe(0);
      expect(RCODE.FORMERR).toBe(1);
      expect(RCODE.SERVFAIL).toBe(2);
      expect(RCODE.NXDOMAIN).toBe(3);
      expect(RCODE.NOTIMP).toBe(4);
      expect(RCODE.REFUSED).toBe(5);
    });

    test("should have no overlapping response codes", () => {
      // Get all values from RCODE
      const values = Object.values(RCODE);

      // Check for duplicates by comparing array length with Set size
      expect(values.length).toBe(new Set(values).size);
    });
  });

  describe("PluginStatus Constants", () => {
    test("should define correct plugin execution statuses", () => {
      // Verify plugin status strings
      expect(PluginStatus.CONTINUE).toBe("continue");
      expect(PluginStatus.RESOLVED).toBe("resolved");
      expect(PluginStatus.ERROR).toBe("error");
    });

    test("should have no overlapping status codes", () => {
      // Get all values from PluginStatus
      const values = Object.values(PluginStatus);

      // Check for duplicates by comparing array length with Set size
      expect(values.length).toBe(new Set(values).size);
    });
  });

  describe("Type Usage", () => {
    test("should provide type definitions for all necessary DNS operations", () => {
      // Check that all necessary groups of constants are defined
      expect(RRType).toBeDefined();
      expect(RCODE).toBeDefined();
      expect(PluginStatus).toBeDefined();

      // Check that object structure is as expected (no additional unexpected exports)
      expect(Object.keys(RRType).length).toBe(11);
      expect(Object.keys(RCODE).length).toBe(6);
      expect(Object.keys(PluginStatus).length).toBe(3);
    });
  });
});
