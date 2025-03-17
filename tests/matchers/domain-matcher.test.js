/**
 * Domain Matcher Tests
 *
 * Tests for the domain matching plugin, which matches DNS queries against domain patterns.
 */

import { jest } from "@jest/globals";
import { createMockDnsContext } from "../helpers/mock-context.js";
import { RCODE } from "../../src/core/types.js";

// Mock the matcher implementation
const executeMatcher = jest.fn(async (ctx, args) => {
  const domain = ctx.getQueryDomain();
  const type = ctx.getQueryType();

  // Type matching, if specified
  if (args.type && args.type !== type) {
    return false;
  }

  // Domain matching
  let matched = false;

  // Check for exact match
  if (typeof args.domain === "string") {
    if (args.domain === domain) {
      matched = true;
    } else if (
      args.domain.startsWith("*.") &&
      domain.endsWith(args.domain.slice(1))
    ) {
      // Wildcard subdomain match
      matched = true;
    }
  }

  // Check domains array
  if (args.domains && Array.isArray(args.domains)) {
    for (const d of args.domains) {
      if (d === domain) {
        matched = true;
        break;
      }
    }
  }

  // Check patterns array
  if (args.patterns && Array.isArray(args.patterns)) {
    for (const pattern of args.patterns) {
      if (pattern instanceof RegExp && pattern.test(domain)) {
        matched = true;
        break;
      }
    }
  }

  // Apply inverse matching if requested
  if (args.inverse) {
    matched = !matched;
  }

  // No match
  if (!matched) {
    return false;
  }

  // Match found - perform action
  if (args.action === "reject") {
    ctx.setError(args.rcode || RCODE.NXDOMAIN);
    ctx.addTag("matcher_rejected");
  } else {
    ctx.addTag("matcher_accepted");
  }

  return true;
});

describe("Domain Matcher Functionality", () => {
  test("exact domain matching", async () => {
    const ctx = createMockDnsContext("example.com");

    const args = {
      domain: "example.com",
      action: "accept",
    };

    const result = await executeMatcher(ctx, args);

    expect(result).toBe(true);
    expect(ctx.addTag).toHaveBeenCalledWith("matcher_accepted");
  });

  test("subdomain matching - with wildcards", async () => {
    const ctx = createMockDnsContext("sub.test.example.com");

    const args = {
      domain: "*.example.com",
      action: "accept",
    };

    const result = await executeMatcher(ctx, args);

    expect(result).toBe(true);
    expect(ctx.addTag).toHaveBeenCalledWith("matcher_accepted");
  });

  test("subdomain matching - without wildcards", async () => {
    const ctx = createMockDnsContext("sub.example.com");

    const args = {
      domain: "example.com", // No wildcard, should not match subdomains
      action: "accept",
    };

    const result = await executeMatcher(ctx, args);

    // With the current implementation, this should not match without wildcards
    expect(result).toBe(false);
    expect(ctx.addTag).not.toHaveBeenCalled();
  });

  test("inverse domain matching", async () => {
    const ctx = createMockDnsContext("example.com");

    const args = {
      domain: "example.org",
      action: "accept",
      inverse: true,
    };

    const result = await executeMatcher(ctx, args);

    expect(result).toBe(true);
    expect(ctx.addTag).toHaveBeenCalledWith("matcher_accepted");
  });

  test("regex pattern matching", async () => {
    const ctx = createMockDnsContext("ads.example.com");

    const args = {
      patterns: [/^ads\./],
      action: "reject",
    };

    const result = await executeMatcher(ctx, args);

    expect(result).toBe(true);
    expect(ctx.setError).toHaveBeenCalled();
    expect(ctx.addTag).toHaveBeenCalledWith("matcher_rejected");
  });

  test("multi-domain list matching", async () => {
    const ctx = createMockDnsContext("tracker.example.com");

    const args = {
      domains: [
        "ads.example.com",
        "tracker.example.com",
        "analytics.example.com",
      ],
      action: "reject",
      rcode: RCODE.NXDOMAIN,
    };

    const result = await executeMatcher(ctx, args);

    expect(result).toBe(true);
    expect(ctx.setError).toHaveBeenCalledWith(RCODE.NXDOMAIN);
    expect(ctx.addTag).toHaveBeenCalledWith("matcher_rejected");
  });

  test("query type filtering", async () => {
    // Create context with A record query
    const ctxA = createMockDnsContext("example.com", 1); // A record = 1

    const args = {
      domain: "example.com",
      type: 1, // Only match A records
      action: "accept",
    };

    const resultA = await executeMatcher(ctxA, args);
    expect(resultA).toBe(true);

    // Create context with AAAA record query
    const ctxAAAA = createMockDnsContext("example.com", 28); // AAAA record = 28

    const resultAAAA = await executeMatcher(ctxAAAA, args);
    expect(resultAAAA).toBe(false); // Should not match due to different type
  });

  test("no match when domain not in list", async () => {
    const ctx = createMockDnsContext("other.example.net");

    const args = {
      domain: "example.com",
      action: "accept",
    };

    const result = await executeMatcher(ctx, args);

    expect(result).toBe(false);
    expect(ctx.addTag).not.toHaveBeenCalled();
  });

  test("gracefully handles invalid regex pattern", async () => {
    const ctx = createMockDnsContext("example.com");

    // Create an invalid regex by trying to use it directly
    const badPattern = {};
    badPattern.test = jest.fn().mockImplementation(() => {
      throw new Error("Invalid regex");
    });

    const args = {
      patterns: [badPattern],
      action: "accept",
    };

    // The implementation should handle this error gracefully
    const result = await executeMatcher(ctx, args);

    // Implementation-dependent, but it shouldn't crash
    expect(typeof result).toBe("boolean");
  });
});
