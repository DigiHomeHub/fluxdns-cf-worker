/**
 * Response Modifier Plugin Tests
 *
 * Tests the DNS response modification functionality to ensure proper
 * modification of responses (TTL adjustment, IP replacement, etc).
 */

import { jest } from "@jest/globals";
import { RCODE } from "../../src/core/types.js";

// Import the module
import { executeResponseModifier } from "../../src/plugins/response-modifier.js";

// Define mocks for internal functions
const mockModifyResponseTTL = jest.fn();
const mockReplaceResponseIPs = jest.fn();

// Define these functions in global scope to make them available to the plugin
global.modifyResponseTTL = mockModifyResponseTTL;
global.replaceResponseIPs = mockReplaceResponseIPs;

describe("Response Modifier Plugin Functionality", () => {
  let mockContext;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock context
    mockContext = {
      getQueryDomain: jest.fn().mockReturnValue("example.com"),
      setResponse: jest.fn(),
      setError: jest.fn(),
      addTag: jest.fn(),
      hasTag: jest.fn().mockReturnValue(false),
      metadata: {},
      resolved: false,
      response: {
        buffer: new Uint8Array([1, 2, 3, 4]).buffer,
      },
    };

    // Mock console methods to avoid polluting test output
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  test("should reject domain with specified RCODE", async () => {
    const args = {
      action: "reject",
      rcode: RCODE.NXDOMAIN,
    };

    const result = await executeResponseModifier(mockContext, args);

    // Verify result
    expect(result).toBe(true);

    // Verify error response was set
    expect(mockContext.setError).toHaveBeenCalledWith(RCODE.NXDOMAIN);

    // Verify tag was added
    expect(mockContext.addTag).toHaveBeenCalledWith("response_rejected");

    // Verify resolved flag was set
    expect(mockContext.resolved).toBe(true);
  });

  test("should accept domain and mark as resolved", async () => {
    const args = {
      action: "accept",
    };

    const result = await executeResponseModifier(mockContext, args);

    // Verify result
    expect(result).toBe(true);

    // Verify tag was added
    expect(mockContext.addTag).toHaveBeenCalledWith("response_accepted");

    // Verify resolved flag was set
    expect(mockContext.resolved).toBe(true);
  });

  test("should skip non-matching domains", async () => {
    mockContext.getQueryDomain.mockReturnValue("nonmatching.com");

    const args = {
      action: "modify",
      ttl: 60,
      domains: ["example.com", "another.com"],
    };

    const result = await executeResponseModifier(mockContext, args);

    // Verify result - should return false for non-matching domain
    expect(result).toBe(false);

    // Verify no tag was added
    expect(mockContext.addTag).not.toHaveBeenCalled();
  });

  test("should handle modify action with ip", async () => {
    const args = {
      action: "modify",
      ip: "192.168.1.1",
      domains: ["example.com"],
    };

    const result = await executeResponseModifier(mockContext, args);

    // Verify behavior
    expect(mockContext.addTag).toHaveBeenCalledWith("ip_replaced");
    expect(result).toBe(true);
  });

  test("should apply to domain patterns", async () => {
    // Test with domain pattern
    const args = {
      action: "reject",
      domains: ["*.example.com"],
    };

    // Set query domain to match pattern
    mockContext.getQueryDomain.mockReturnValue("sub.example.com");

    const result = await executeResponseModifier(mockContext, args);

    // Verify result
    expect(result).toBe(true);
    expect(mockContext.setError).toHaveBeenCalled();
  });

  test("should not modify response when no response exists", async () => {
    // Set response to undefined
    mockContext.response = undefined;

    const args = {
      action: "modify",
      ttl: 60,
      domains: ["example.com"],
    };

    const result = await executeResponseModifier(mockContext, args);

    // Verify result - should return false when response doesn't exist
    expect(result).toBe(false);
  });

  test("should handle errors gracefully", async () => {
    // Force an error by making setError throw
    mockContext.setError.mockImplementation(() => {
      throw new Error("Test error");
    });

    const args = {
      action: "reject",
    };

    const result = await executeResponseModifier(mockContext, args);

    // Verify result
    expect(result).toBe(false);

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error in response modifier plugin"),
      expect.any(Error)
    );
  });
});
