/**
 * Ad Blocking Plugin Tests
 *
 * Tests the ad domain blocking functionality to ensure proper filtering of ad domains.
 */

import { jest } from "@jest/globals";
import { executeAdBlock } from "../../src/plugins/adblock.js";
import { RCODE } from "../../src/core/types.js";

describe("AdBlock Plugin Functionality", () => {
  let mockContext;
  let consoleSpy;

  beforeEach(() => {
    // Create mock context
    mockContext = {
      getQueryDomain: jest.fn().mockReturnValue("example.com"),
      setError: jest.fn(),
      addTag: jest.fn(),
      resolved: false,
      metadata: {},
    };

    // Mock console methods to avoid polluting test output
    consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    // Clean up mocks
    jest.restoreAllMocks();
  });

  test("should block domain containing ad pattern", async () => {
    // Set query domain to an ad domain
    mockContext.getQueryDomain.mockReturnValue("ads.example.com");

    const args = {};

    const result = await executeAdBlock(mockContext, args);

    // Verify result
    expect(result).toBe(true);

    // Verify error response was set
    expect(mockContext.setError).toHaveBeenCalledWith(RCODE.NXDOMAIN);

    // Verify resolved flag and tag
    expect(mockContext.resolved).toBe(true);
    expect(mockContext.addTag).toHaveBeenCalledWith("adblock_filtered");

    // Verify logging
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Blocking ad domain: ads.example.com")
    );
  });

  test("should block domains with different ad patterns", async () => {
    // Test different ad patterns
    const adDomains = [
      "ad.example.com",
      "adserver.example.com",
      "advert.example.com",
      "banner.example.com",
      "track.example.com",
      "analytics.example.com",
      "stats.example.com",
      "pixel.example.com",
      "metrics.example.com",
      "marketing.example.com",
    ];

    for (const domain of adDomains) {
      // Reset mocks
      jest.clearAllMocks();
      mockContext.getQueryDomain.mockReturnValue(domain);

      const result = await executeAdBlock(mockContext, {});

      // Verify domain was blocked
      expect(result).toBe(true);
      expect(mockContext.setError).toHaveBeenCalledWith(RCODE.NXDOMAIN);
    }
  });

  test("should not block non-ad domains", async () => {
    // Set query domain to a non-ad domain
    mockContext.getQueryDomain.mockReturnValue("example.com");

    const args = {};

    const result = await executeAdBlock(mockContext, args);

    // Verify result
    expect(result).toBe(false);

    // Verify no error response was set
    expect(mockContext.setError).not.toHaveBeenCalled();
    expect(mockContext.addTag).not.toHaveBeenCalled();
  });

  test("should respect whitelist domains", async () => {
    // Set query domain to an ad domain that's whitelisted
    mockContext.getQueryDomain.mockReturnValue("ads.whitelist.com");

    const args = {
      whitelist: ["whitelist.com"],
    };

    const result = await executeAdBlock(mockContext, args);

    // Verify result
    expect(result).toBe(false);

    // Verify no error response was set
    expect(mockContext.setError).not.toHaveBeenCalled();

    // Verify logging
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Skipping whitelisted domain: ads.whitelist.com")
    );
  });

  test("should use custom patterns", async () => {
    // Set query domain to match custom pattern
    mockContext.getQueryDomain.mockReturnValue("custom-pattern.example.com");

    const args = {
      patterns: ["custom-pattern"],
    };

    const result = await executeAdBlock(mockContext, args);

    // Verify result
    expect(result).toBe(true);

    // Verify error response was set
    expect(mockContext.setError).toHaveBeenCalled();
  });

  test("should return false when domain is missing", async () => {
    // Set domain to null
    mockContext.getQueryDomain.mockReturnValue(null);

    const args = {};

    const result = await executeAdBlock(mockContext, args);

    // Verify result
    expect(result).toBe(false);
  });

  test("should disable logging when log=false", async () => {
    // Set query domain to an ad domain
    mockContext.getQueryDomain.mockReturnValue("ads.example.com");

    const args = {
      log: false,
    };

    const result = await executeAdBlock(mockContext, args);

    // Verify result
    expect(result).toBe(true);

    // Verify no logging occurred
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  test("should handle subdomain of whitelisted domain", async () => {
    // Set query domain to a subdomain of a whitelisted domain
    mockContext.getQueryDomain.mockReturnValue("sub.ads.whitelist.com");

    const args = {
      whitelist: ["ads.whitelist.com"],
    };

    const result = await executeAdBlock(mockContext, args);

    // Verify result
    expect(result).toBe(false);

    // Verify logging
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Skipping whitelisted domain")
    );
  });

  test("should not consider whitelisted domain suffix as part of domain", async () => {
    // Domain that ends with whitelist domain but is not a subdomain
    mockContext.getQueryDomain.mockReturnValue("fake-whitelist.com");

    const args = {
      whitelist: ["whitelist.com"],
    };

    const result = await executeAdBlock(mockContext, args);

    // Verify result - should not be whitelisted
    expect(result).toBe(false);

    // Verify no whitelist logging occurred
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Skipping whitelisted domain")
    );
  });
});
