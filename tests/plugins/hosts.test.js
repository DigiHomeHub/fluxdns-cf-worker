/**
 * Hosts Plugin Tests
 *
 * Tests the host resolution functionality.
 */

import { jest } from "@jest/globals";
import { RRType, RCODE } from "../../src/core/types.js";

// Mock the normalizeDomain function directly
const mockNormalizeDomain = jest.fn((domain) =>
  domain ? domain.toLowerCase().replace(/\.$/, "") : null
);

// Mock the dns-util module
const mockDnsUtil = {
  normalizeDomain: mockNormalizeDomain,
};

// Mock the hosts.js module first
jest.mock("../../src/utils/dns-util.js", () => mockDnsUtil, { virtual: true });

// Create a mock for generateMockResponse function
const mockGenerateMockResponse = jest.fn((dnsMessage, ips, ttl) => ({
  type: ips[0].includes(":") ? RRType.AAAA : RRType.A,
  address: ips[0],
}));

// Define generateMockResponse in global scope so the plugin can find it
global.generateMockResponse = mockGenerateMockResponse;

// Now import the mocked module
import { executeHosts } from "../../src/plugins/hosts.js";

describe("Hosts Plugin Functionality", () => {
  let mockContext;
  let consoleSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Set up spies
    consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    // Create a mock buffer for DNS message
    const mockBuffer = new ArrayBuffer(10);

    // Set up mock context with methods required by the hosts plugin
    mockContext = {
      getQueryDomain: jest.fn().mockReturnValue("example.com"),
      getQueryType: jest.fn().mockReturnValue(RRType.A),
      setError: jest.fn(),
      addTag: jest.fn(),
      setResponse: jest.fn(),
      dnsMessage: {
        buffer: mockBuffer,
      },
    };
  });

  afterEach(() => {
    // Clean up mocks
    jest.restoreAllMocks();
    mockNormalizeDomain.mockClear();
    mockGenerateMockResponse.mockClear();
  });

  test("should resolve A records", async () => {
    const args = {
      hosts: {
        "example.com": "192.168.1.1",
      },
    };

    await executeHosts(mockContext, args);

    // Check if console.log was called with the expected message
    expect(consoleSpy).toHaveBeenCalledWith(
      "Would respond to example.com with 192.168.1.1"
    );

    // Check other side effects
    expect(mockContext.setResponse).toHaveBeenCalledWith(
      expect.any(ArrayBuffer)
    );
    expect(mockContext.addTag).toHaveBeenCalledWith("hosts_resolved");
  });

  test("should resolve AAAA records", async () => {
    mockContext.getQueryType.mockReturnValue(RRType.AAAA);

    const args = {
      hosts: {
        "example.com": "2001:db8::1",
      },
    };

    await executeHosts(mockContext, args);

    // Check if console.log was called with the expected message
    expect(consoleSpy).toHaveBeenCalledWith(
      "Would respond to example.com with 2001:db8::1"
    );

    // Check other side effects
    expect(mockContext.setResponse).toHaveBeenCalledWith(
      expect.any(ArrayBuffer)
    );
    expect(mockContext.addTag).toHaveBeenCalledWith("hosts_resolved");
  });

  test("should handle multiple IP addresses", async () => {
    const args = {
      hosts: {
        "example.com": ["192.168.1.1", "192.168.1.2"],
      },
    };

    await executeHosts(mockContext, args);

    // Check if console.log was called with the expected message
    expect(consoleSpy).toHaveBeenCalledWith(
      "Would respond to example.com with 192.168.1.1, 192.168.1.2"
    );

    // Check other side effects
    expect(mockContext.setResponse).toHaveBeenCalledWith(
      expect.any(ArrayBuffer)
    );
    expect(mockContext.addTag).toHaveBeenCalledWith("hosts_resolved");
  });

  test("should filter IPs by query type", async () => {
    const args = {
      hosts: {
        "example.com": ["192.168.1.1", "2001:db8::1"],
      },
    };

    await executeHosts(mockContext, args);

    // Check if console.log was called with the expected message
    expect(consoleSpy).toHaveBeenCalledWith(
      "Would respond to example.com with 192.168.1.1"
    );

    // Should not include IPv6 in the output
    expect(consoleSpy.mock.calls[0][0]).not.toContain("2001:db8::1");

    // Check other side effects
    expect(mockContext.setResponse).toHaveBeenCalledWith(
      expect.any(ArrayBuffer)
    );
    expect(mockContext.addTag).toHaveBeenCalledWith("hosts_resolved");
  });

  test("should return false for unmatched domain", async () => {
    mockContext.getQueryDomain.mockReturnValue("nonexistent.com");

    const args = {
      hosts: {
        "example.com": "192.168.1.1",
      },
    };

    const result = await executeHosts(mockContext, args);

    // Verify result
    expect(result).toBe(false);

    // Verify no response was set
    expect(mockContext.setResponse).not.toHaveBeenCalled();

    // Verify no tag was added
    expect(mockContext.addTag).not.toHaveBeenCalled();
  });

  test("should return false for unsupported query type", async () => {
    mockContext.getQueryType.mockReturnValue(RRType.MX);

    const args = {
      hosts: {
        "example.com": "192.168.1.1",
      },
    };

    const result = await executeHosts(mockContext, args);

    // Verify result
    expect(result).toBe(false);

    // Verify no response was set
    expect(mockContext.setResponse).not.toHaveBeenCalled();
  });

  test("should handle passThrough=false when no matching IPs", async () => {
    mockContext.getQueryType.mockReturnValue(RRType.AAAA);

    const args = {
      hosts: {
        "example.com": "192.168.1.1", // Only IPv4, no IPv6
      },
      passThrough: false,
    };

    const result = await executeHosts(mockContext, args);

    // Verify result
    expect(result).toBe(true);

    // Verify error was set to NOERROR
    expect(mockContext.setError).toHaveBeenCalledWith(RCODE.NOERROR);

    // Verify no response was set
    expect(mockContext.setResponse).not.toHaveBeenCalled();
  });

  test("should handle passThrough=true when no matching IPs", async () => {
    mockContext.getQueryType.mockReturnValue(RRType.AAAA);

    const args = {
      hosts: {
        "example.com": "192.168.1.1", // Only IPv4, no IPv6
      },
      passThrough: true,
    };

    const result = await executeHosts(mockContext, args);

    // Verify result
    expect(result).toBe(false);

    // Verify no error or response was set
    expect(mockContext.setError).not.toHaveBeenCalled();
    expect(mockContext.setResponse).not.toHaveBeenCalled();
  });

  test("should return false when domain is missing", async () => {
    mockContext.getQueryDomain.mockReturnValue(null);

    const args = {
      hosts: {
        "example.com": "192.168.1.1",
      },
    };

    const result = await executeHosts(mockContext, args);

    // Verify result
    expect(result).toBe(false);
  });

  test("should handle domain normalization", async () => {
    mockContext.getQueryDomain.mockReturnValue("example.com.");

    const args = {
      hosts: {
        "example.com": "192.168.1.1",
      },
    };

    await executeHosts(mockContext, args);

    // Verify it calls getQueryDomain and then normalization happens internally
    expect(mockContext.getQueryDomain).toHaveBeenCalled();

    // Check other side effects that indicate the function worked
    expect(mockContext.setResponse).toHaveBeenCalledWith(
      expect.any(ArrayBuffer)
    );
    expect(mockContext.addTag).toHaveBeenCalledWith("hosts_resolved");
  });

  test("should handle errors gracefully", async () => {
    // Force an error by making setResponse throw
    mockContext.setResponse.mockImplementation(() => {
      throw new Error("Test error");
    });

    const args = {
      hosts: {
        "example.com": "192.168.1.1",
      },
    };

    const result = await executeHosts(mockContext, args);

    // Verify result
    expect(result).toBe(false);

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error in hosts plugin"),
      expect.any(Error)
    );
  });
});
