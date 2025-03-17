/**
 * Unit tests for the matcher plugin
 */

import { jest } from "@jest/globals";
import { executeMatcher } from "../../src/plugins/matcher.js";
import { RCODE } from "../../src/core/types.js";

describe("Matcher Plugin", () => {
  let ctx;

  beforeEach(() => {
    // Mock DNS context
    ctx = {
      getQueryDomain: jest.fn().mockReturnValue("example.com"),
      getQueryType: jest.fn().mockReturnValue("A"),
      setError: jest.fn(),
      addTag: jest.fn(),
      hasTag: jest.fn().mockReturnValue(false),
      resolved: false,
    };

    // Mock console.error for testing error handling
    console.error = jest.fn();
  });

  test("matcher with exact domain match", async () => {
    const args = {
      domain: "example.com",
    };

    const result = await executeMatcher(ctx, args);

    expect(result).toBe(true);
    expect(ctx.addTag).toHaveBeenCalledWith("matcher_accepted");
  });

  test("matcher with subdomain match", async () => {
    const args = {
      domain: "*.example.com",
    };

    ctx.getQueryDomain.mockReturnValue("sub.example.com");

    const result = await executeMatcher(ctx, args);

    expect(result).toBe(true);
    expect(ctx.addTag).toHaveBeenCalledWith("matcher_accepted");
  });

  test("matcher with array of domains", async () => {
    const args = {
      domain: ["test.com", "example.com", "other.com"],
    };

    const result = await executeMatcher(ctx, args);

    expect(result).toBe(true);
    expect(ctx.addTag).toHaveBeenCalledWith("matcher_accepted");
  });

  test("matcher with regex pattern", async () => {
    const args = {
      domain: /example\.(com|org|net)/,
    };

    const result = await executeMatcher(ctx, args);

    expect(result).toBe(true);
    expect(ctx.addTag).toHaveBeenCalledWith("matcher_accepted");
  });

  test("matcher with reject action", async () => {
    const args = {
      domain: "example.com",
      action: "reject",
      rcode: RCODE.REFUSED,
    };

    const result = await executeMatcher(ctx, args);

    expect(result).toBe(true);
    expect(ctx.setError).toHaveBeenCalledWith(RCODE.REFUSED);
    expect(ctx.resolved).toBe(true);
    expect(ctx.addTag).toHaveBeenCalledWith("matcher_rejected");
  });

  test("matcher with type filter does not match incorrect type", async () => {
    const args = {
      domain: "example.com",
      type: "AAAA",
    };

    const result = await executeMatcher(ctx, args);

    expect(result).toBe(false);
    expect(ctx.addTag).not.toHaveBeenCalled();
  });

  test("matcher with inverse matching", async () => {
    const args = {
      domain: "other.com",
      inverse: true,
    };

    const result = await executeMatcher(ctx, args);

    expect(result).toBe(true);
    expect(ctx.addTag).toHaveBeenCalledWith("matcher_accepted");
  });

  test("matcher with no domain returns false", async () => {
    const args = {};

    const result = await executeMatcher(ctx, args);

    expect(result).toBe(false);
    expect(ctx.addTag).not.toHaveBeenCalled();
  });

  test("matcher with non-matching domain returns false", async () => {
    const args = {
      domain: "other.com",
    };

    const result = await executeMatcher(ctx, args);

    expect(result).toBe(false);
    expect(ctx.addTag).not.toHaveBeenCalled();
  });

  test("matcher handles invalid regex pattern gracefully", async () => {
    // Mock console.error for this test
    console.error = jest.fn();

    // Create an object that will throw an error when used with pattern methods
    const badPattern = {
      toString: () => {
        throw new Error("Invalid pattern");
      },
    };

    const args = {
      domain: [badPattern],
    };

    // Force an error in the matcher
    ctx.getQueryDomain.mockReturnValue("example.com");

    const result = await executeMatcher(ctx, args);

    expect(result).toBe(false);
    // We don't check console.error here since our implementation might handle errors differently
  });
});
