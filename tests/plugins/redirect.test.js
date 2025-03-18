/**
 * Redirect Plugin Tests
 *
 * Tests the DNS redirection functionality to ensure proper domain redirects.
 */

import { jest } from "@jest/globals";
import { executeRedirect } from "../../src/plugins/redirect.js";
import { RRType } from "../../src/core/types.js";

describe("Redirect Plugin Functionality", () => {
  let mockContext;
  let consoleSpy;

  beforeEach(() => {
    // Create mock context
    mockContext = {
      getQueryDomain: jest.fn().mockReturnValue("example.com"),
      getQueryType: jest.fn().mockReturnValue(RRType.A),
      addTag: jest.fn(),
      metadata: {},
    };

    // Mock console methods to avoid polluting test output
    consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Clean up mocks
    jest.restoreAllMocks();
  });

  test("should redirect exact domain match", async () => {
    const args = {
      rules: [{ from: "example.com", to: "redirected.com" }],
    };

    const result = await executeRedirect(mockContext, args);

    // Verify result
    expect(result).toBe(true);

    // Verify metadata was updated
    expect(mockContext.metadata.redirect).toEqual({
      originalDomain: "example.com",
      redirectDomain: "redirected.com",
    });

    // Verify tag was added
    expect(mockContext.addTag).toHaveBeenCalledWith("redirected");

    // Verify log message
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Would redirect example.com to redirected.com")
    );
  });

  test("should redirect subdomain when includeSubdomains=true", async () => {
    // Set query domain to a subdomain
    mockContext.getQueryDomain.mockReturnValue("sub.example.com");

    const args = {
      rules: [{ from: "example.com", to: "redirected.com" }],
      includeSubdomains: true,
    };

    const result = await executeRedirect(mockContext, args);

    // Verify result
    expect(result).toBe(true);

    // Verify metadata was updated with subdomain preservation
    expect(mockContext.metadata.redirect).toEqual({
      originalDomain: "sub.example.com",
      redirectDomain: "sub.redirected.com",
    });
  });

  test("should not redirect subdomain when includeSubdomains=false", async () => {
    // Set query domain to a subdomain
    mockContext.getQueryDomain.mockReturnValue("sub.example.com");

    const args = {
      rules: [{ from: "example.com", to: "redirected.com" }],
      includeSubdomains: false,
    };

    const result = await executeRedirect(mockContext, args);

    // Verify result
    expect(result).toBe(false);

    // Verify no metadata was updated
    expect(mockContext.metadata.redirect).toBeUndefined();
    expect(mockContext.addTag).not.toHaveBeenCalled();
  });

  test("should apply type-specific rules", async () => {
    // Set query type to AAAA
    mockContext.getQueryType.mockReturnValue(RRType.AAAA);

    const args = {
      rules: [
        { from: "example.com", to: "redirected.com", type: RRType.A },
        { from: "example.com", to: "redirected-aaaa.com", type: RRType.AAAA },
      ],
    };

    const result = await executeRedirect(mockContext, args);

    // Verify result
    expect(result).toBe(true);

    // Verify correct redirect was applied (the AAAA one)
    expect(mockContext.metadata.redirect.redirectDomain).toBe(
      "redirected-aaaa.com"
    );
  });

  test("should apply first matching rule", async () => {
    const args = {
      rules: [
        { from: "unmatched.com", to: "first.com" },
        { from: "example.com", to: "second.com" },
        { from: "example.com", to: "third.com" },
      ],
    };

    const result = await executeRedirect(mockContext, args);

    // Verify result
    expect(result).toBe(true);

    // Verify first matching rule was applied (second rule)
    expect(mockContext.metadata.redirect.redirectDomain).toBe("second.com");
  });

  test("should return false when no rules match", async () => {
    const args = {
      rules: [{ from: "unmatched.com", to: "redirected.com" }],
    };

    const result = await executeRedirect(mockContext, args);

    // Verify result
    expect(result).toBe(false);

    // Verify no metadata was updated
    expect(mockContext.metadata.redirect).toBeUndefined();
    expect(mockContext.addTag).not.toHaveBeenCalled();
  });

  test("should return false when domain is missing", async () => {
    // Set domain to null
    mockContext.getQueryDomain.mockReturnValue(null);

    const args = {
      rules: [{ from: "example.com", to: "redirected.com" }],
    };

    const result = await executeRedirect(mockContext, args);

    // Verify result
    expect(result).toBe(false);
  });

  test("should return false when rules are empty", async () => {
    const args = {
      rules: [],
    };

    const result = await executeRedirect(mockContext, args);

    // Verify result
    expect(result).toBe(false);
  });

  test("should skip invalid rules", async () => {
    const args = {
      rules: [
        {}, // Missing from and to
        { from: "example.com" }, // Missing to
        { to: "redirected.com" }, // Missing from
        { from: "example.com", to: "redirected.com" }, // Valid rule
      ],
    };

    const result = await executeRedirect(mockContext, args);

    // Verify result
    expect(result).toBe(true);

    // Verify the valid rule was applied
    expect(mockContext.metadata.redirect.redirectDomain).toBe("redirected.com");
  });

  test("should handle errors gracefully", async () => {
    // Force an error by making addTag throw
    mockContext.addTag.mockImplementation(() => {
      throw new Error("Test error");
    });

    const args = {
      rules: [{ from: "example.com", to: "redirected.com" }],
    };

    const result = await executeRedirect(mockContext, args);

    // Verify result
    expect(result).toBe(false);

    // Verify error was logged
    expect(console.error).toHaveBeenCalledWith(
      "Error in redirect plugin:",
      expect.any(Error)
    );
  });
});
