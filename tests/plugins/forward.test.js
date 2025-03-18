/**
 * Forward Plugin Tests
 *
 * Tests the DNS forwarding functionality to ensure proper query forwarding to upstream DNS servers.
 */

import { jest } from "@jest/globals";
import { executeForward } from "../../src/plugins/forward.js";

describe("Forward Plugin Functionality", () => {
  let mockContext;
  let fetchSpy;
  let consoleSpy;
  let originalFetch;

  beforeEach(() => {
    // Store original fetch function
    originalFetch = global.fetch;

    // Create mock response
    const mockResponseBuffer = new Uint8Array([1, 2, 3, 4]).buffer;

    // Mock the fetch function
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: jest.fn().mockResolvedValue(mockResponseBuffer),
    });

    fetchSpy = jest.spyOn(global, "fetch");

    // Create mock context
    mockContext = {
      dnsMessage: {
        buffer: new Uint8Array([5, 6, 7, 8]).buffer,
      },
      setResponse: jest.fn(),
      addTag: jest.fn(),
      metadata: {
        stats: {},
        timings: {
          start: Date.now() - 100, // Simulate request started 100ms ago
        },
      },
    };

    // Mock console.error to avoid polluting test output
    consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore mocks
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("should forward request to default upstream server", async () => {
    const args = {};

    const result = await executeForward(mockContext, args);

    // Verify result
    expect(result).toBe(true);

    // Verify fetch was called with correct parameters
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://security.cloudflare-dns.com/dns-query",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Accept: "application/dns-message",
          "Content-Type": "application/dns-message",
        }),
        body: mockContext.dnsMessage.buffer,
      })
    );

    // Verify response was set
    expect(mockContext.setResponse).toHaveBeenCalled();

    // Verify metadata was updated
    expect(mockContext.metadata.upstream).toBe(
      "https://security.cloudflare-dns.com/dns-query"
    );
    expect(mockContext.metadata.stats.upstreamResponseTime).toBeDefined();
  });

  test("should forward request to custom upstream server", async () => {
    const args = {
      upstream: "https://dns.google/dns-query",
    };

    const result = await executeForward(mockContext, args);

    // Verify result
    expect(result).toBe(true);

    // Verify fetch was called with correct upstream
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://dns.google/dns-query",
      expect.any(Object)
    );
  });

  test("should normalize upstream URL", async () => {
    const args = {
      upstream: "dns.google",
    };

    const result = await executeForward(mockContext, args);

    // Verify result
    expect(result).toBe(true);

    // Verify fetch was called with normalized URL
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://dns.google/dns-query",
      expect.any(Object)
    );
  });

  test("should add custom headers", async () => {
    const args = {
      headers: {
        "X-Custom-Header": "test-value",
      },
    };

    const result = await executeForward(mockContext, args);

    // Verify result
    expect(result).toBe(true);

    // Verify fetch was called with custom headers
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Custom-Header": "test-value",
        }),
      })
    );
  });

  test("should handle fetch errors", async () => {
    // Mock fetch to reject
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

    const args = {};

    const result = await executeForward(mockContext, args);

    // Verify result
    expect(result).toBe(false);

    // Verify error handling
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error in forward plugin:",
      expect.any(Error)
    );

    // Verify metadata was updated with error
    expect(mockContext.metadata.upstreamError).toBe("Network error");
  });

  test("should handle non-OK responses", async () => {
    // Mock fetch to return error status
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const args = {};

    const result = await executeForward(mockContext, args);

    // Verify result
    expect(result).toBe(false);

    // Verify error handling
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error in forward plugin:",
      expect.any(Error)
    );

    // Verify error message contains status
    expect(mockContext.metadata.upstreamError).toContain("500");
  });

  test("should handle request timeout", async () => {
    // Mock setTimeout and AbortController
    jest.useFakeTimers();

    const mockAbortController = {
      signal: "mock-signal",
      abort: jest.fn(),
    };

    global.AbortController = jest.fn(() => mockAbortController);

    const args = {
      timeout: 2000,
    };

    // Start executing but don't await
    const forwardPromise = executeForward(mockContext, args);

    // Fast-forward timers to trigger timeout
    jest.advanceTimersByTime(2001);

    // Verify abort was called
    expect(mockAbortController.abort).toHaveBeenCalled();

    // Clean up
    jest.useRealTimers();
  });

  test("should use EDNS client subnet when enabled", async () => {
    // Mock client IP
    mockContext.metadata.clientInfo = {
      ip: "192.168.1.1",
    };

    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const args = {
      edns_client_subnet: true,
    };

    const result = await executeForward(mockContext, args);

    // Verify result
    expect(result).toBe(true);

    // Verify log was called (since actual ECS implementation is placeholder)
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Would add ECS for client IP"),
      "192.168.1.1"
    );
  });
});
