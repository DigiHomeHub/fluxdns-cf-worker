/**
 * Cache Plugin Tests
 *
 * Tests the DNS caching functionality to ensure proper caching and retrieval of DNS responses.
 */

import { jest } from "@jest/globals";
import { executeCache } from "../../src/plugins/cache.js";
import { RRType } from "../../src/core/types.js";

describe("Cache Plugin Functionality", () => {
  let mockContext;
  let originalSetResponse;
  let cachedResponseBuffer;
  let errorSpy;

  beforeEach(() => {
    // Create cached response data
    cachedResponseBuffer = new Uint8Array([1, 2, 3, 4]).buffer;

    // Reset global cache mock
    global.caches = {
      default: {
        match: jest.fn().mockResolvedValue(null), // Default to cache miss
        put: jest.fn().mockResolvedValue(undefined),
      },
    };

    // Create mock context
    mockContext = {
      getQueryDomain: jest.fn().mockReturnValue("example.com"),
      getQueryType: jest.fn().mockReturnValue(RRType.A),
      setResponse: jest.fn(),
      addTag: jest.fn(),
      hasTag: jest.fn().mockReturnValue(false), // Default to no tags
      resolved: false,
      metadata: {},
    };

    // Store original setResponse function for later verification
    originalSetResponse = mockContext.setResponse;

    // Mock console.error to avoid polluting test output
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Clean up mocks
    jest.restoreAllMocks();
  });

  test("should return false and set metadata when cache miss", async () => {
    const args = { ttl: 300 };

    const result = await executeCache(mockContext, args);

    // Verify result and tags
    expect(result).toBe(false);
    expect(mockContext.addTag).toHaveBeenCalledWith("cache_miss");

    // Verify metadata is set
    expect(mockContext.metadata.cacheKey).toBe("dns-example.com-1");
    expect(mockContext.metadata.cacheTtl).toBe(300);

    // Verify setResponse has been replaced
    expect(mockContext.setResponse).not.toBe(originalSetResponse);
  });

  test("should return true and set response on cache hit", async () => {
    // Mock cache hit
    const mockCachedResponse = {
      arrayBuffer: jest.fn().mockResolvedValue(cachedResponseBuffer),
    };
    global.caches.default.match.mockResolvedValue(mockCachedResponse);

    const args = { ttl: 300 };

    const result = await executeCache(mockContext, args);

    // Verify result and calls
    expect(result).toBe(true);
    expect(mockContext.addTag).toHaveBeenCalledWith("cache_hit");
    expect(mockContext.setResponse).toHaveBeenCalledWith(cachedResponseBuffer);
    expect(mockContext.resolved).toBe(true);
  });

  test("should return false when domain or type is missing", async () => {
    // Mock domain as null
    mockContext.getQueryDomain.mockReturnValue(null);

    const args = { ttl: 300 };

    const result = await executeCache(mockContext, args);

    // Verify result
    expect(result).toBe(false);
    expect(mockContext.addTag).not.toHaveBeenCalled();

    // Reset and test null type
    mockContext.getQueryDomain.mockReturnValue("example.com");
    mockContext.getQueryType.mockReturnValue(null);

    const result2 = await executeCache(mockContext, args);

    expect(result2).toBe(false);
    expect(mockContext.addTag).not.toHaveBeenCalled();
  });

  test("should bypass cache when bypass_cache tag exists", async () => {
    // Mock bypass_cache tag
    mockContext.hasTag.mockImplementation((tag) => tag === "bypass_cache");

    const args = { ttl: 300 };

    const result = await executeCache(mockContext, args);

    // Verify result and tags
    expect(result).toBe(false);
    expect(mockContext.addTag).toHaveBeenCalledWith("cache_bypassed");
    expect(global.caches.default.match).not.toHaveBeenCalled();
  });

  test("should set new setResponse function on cache miss", async () => {
    const args = { ttl: 300 };

    await executeCache(mockContext, args);

    // Verify setResponse has been replaced
    expect(mockContext.setResponse).not.toBe(originalSetResponse);

    // Mock response data
    const responseBuffer = new Uint8Array([5, 6, 7, 8]).buffer;

    // Call the new setResponse
    mockContext.setResponse(responseBuffer);

    // Verify cache storage
    expect(global.caches.default.put).toHaveBeenCalled();

    // Extract call parameters
    const [cacheKey, response] = global.caches.default.put.mock.calls[0];
    expect(cacheKey).toBe("dns-example.com-1");

    // Verify response headers
    expect(response.headers.get("Content-Type")).toBe(
      "application/dns-message"
    );
    expect(response.headers.get("Cache-Control")).toBe("max-age=300");
  });

  test("should use custom TTL for cache", async () => {
    const args = { ttl: 60 }; // Custom TTL of 60 seconds

    await executeCache(mockContext, args);

    // Verify TTL is saved
    expect(mockContext.metadata.cacheTtl).toBe(60);

    // Mock response data
    const responseBuffer = new Uint8Array([5, 6, 7, 8]).buffer;

    // Call the new setResponse
    mockContext.setResponse(responseBuffer);

    // Extract Response object
    const [, response] = global.caches.default.put.mock.calls[0];

    // Verify Cache-Control header
    expect(response.headers.get("Cache-Control")).toBe("max-age=60");
  });

  test("should use different cache keys for different query types", async () => {
    // Test A record
    mockContext.getQueryDomain.mockReturnValue("example.com");
    mockContext.getQueryType.mockReturnValue(RRType.A);

    await executeCache(mockContext, { ttl: 300 });

    expect(mockContext.metadata.cacheKey).toBe("dns-example.com-1");

    // Reset context
    mockContext.metadata = {};

    // Test AAAA record
    mockContext.getQueryType.mockReturnValue(RRType.AAAA);

    await executeCache(mockContext, { ttl: 300 });

    expect(mockContext.metadata.cacheKey).toBe("dns-example.com-28");
  });
});
