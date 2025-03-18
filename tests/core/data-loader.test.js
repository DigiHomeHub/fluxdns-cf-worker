/**
 * Unit tests for the Data Loader
 *
 * These tests verify the functionality of the data loading utilities,
 * including domain lists, IP lists, and hosts files loading, parsing,
 * and caching mechanisms.
 */

import { jest } from "@jest/globals";
import {
  loadDomainList,
  loadIPList,
  loadHostsFile,
  clearCache,
  getCacheStats,
} from "../../src/core/data-loader.js";

// Mock Date.now to control cache expiration
const originalDateNow = Date.now;

describe("Data Loader Functionality", () => {
  let mockEnv;
  let mockKV;

  beforeEach(() => {
    // Reset mocks between tests
    jest.clearAllMocks();

    // Mock KV store
    mockKV = {
      get: jest.fn(),
    };

    // Mock environment with KV binding
    mockEnv = {
      DATA_KV: mockKV,
    };

    // Mock console methods to avoid polluting test output
    console.error = jest.fn();

    // Mock Date.now to control cache expiration
    global.Date.now = jest.fn(() => 1000);
  });

  afterEach(() => {
    // Restore Date.now
    global.Date.now = originalDateNow;

    // Clear cache between tests
    clearCache();
  });

  describe("Domain List Loader", () => {
    test("should load and parse domain list from KV", async () => {
      // Setup mock KV response
      const mockDomains = "example.com\n# Comment\ntest.org\n\nexample.net";
      mockKV.get.mockResolvedValue(mockDomains);

      const domains = await loadDomainList("blocked_domains", mockEnv);

      // Verify KV was called
      expect(mockKV.get).toHaveBeenCalledWith("blocked_domains");

      // Verify domains were parsed correctly (ignoring comments and empty lines)
      expect(domains.size).toBe(3);
      expect(domains.has("example.com")).toBe(true);
      expect(domains.has("test.org")).toBe(true);
      expect(domains.has("example.net")).toBe(true);
    });

    test("should return empty set when domain list not found", async () => {
      // Setup mock KV to return null
      mockKV.get.mockResolvedValue(null);

      const domains = await loadDomainList("nonexistent", mockEnv);

      // Verify KV was called
      expect(mockKV.get).toHaveBeenCalledWith("nonexistent");

      // Verify empty set was returned
      expect(domains.size).toBe(0);
    });

    test("should use cached domain list when available", async () => {
      // First call - load from KV
      mockKV.get.mockResolvedValue("example.com\ntest.org");
      const domains1 = await loadDomainList("blocked_domains", mockEnv);

      // Second call - should use cache
      const domains2 = await loadDomainList("blocked_domains", mockEnv);

      // Verify KV was called only once
      expect(mockKV.get).toHaveBeenCalledTimes(1);

      // Verify both results are the same
      expect(domains1).toBe(domains2);
    });

    test("should reload when cache is expired", async () => {
      // First call - load from KV
      mockKV.get.mockResolvedValue("example.com\ntest.org");
      await loadDomainList("blocked_domains", mockEnv);

      // Advance time beyond cache TTL
      global.Date.now = jest.fn(() => 1000 + 31 * 60 * 1000); // 31 minutes later

      // Second call - should reload from KV
      await loadDomainList("blocked_domains", mockEnv);

      // Verify KV was called twice
      expect(mockKV.get).toHaveBeenCalledTimes(2);
    });

    test("should handle errors gracefully", async () => {
      // Setup mock KV to throw error
      mockKV.get.mockRejectedValue(new Error("KV error"));

      const domains = await loadDomainList("blocked_domains", mockEnv);

      // Verify error was logged
      expect(console.error).toHaveBeenCalled();

      // Verify empty set was returned
      expect(domains.size).toBe(0);
    });
  });

  describe("IP List Loader", () => {
    test("should load and parse IP list from KV", async () => {
      // Setup mock KV response
      const mockIPs = "192.168.1.1\n# Comment\n10.0.0.1\n\n172.16.0.1";
      mockKV.get.mockResolvedValue(mockIPs);

      const ips = await loadIPList("blocked_ips", mockEnv);

      // Verify KV was called
      expect(mockKV.get).toHaveBeenCalledWith("blocked_ips");

      // Verify IPs were parsed correctly (ignoring comments and empty lines)
      expect(ips.size).toBe(3);
      expect(ips.has("192.168.1.1")).toBe(true);
      expect(ips.has("10.0.0.1")).toBe(true);
      expect(ips.has("172.16.0.1")).toBe(true);
    });

    test("should use cached IP list when available", async () => {
      // First call - load from KV
      mockKV.get.mockResolvedValue("192.168.1.1\n10.0.0.1");
      const ips1 = await loadIPList("blocked_ips", mockEnv);

      // Second call - should use cache
      const ips2 = await loadIPList("blocked_ips", mockEnv);

      // Verify KV was called only once
      expect(mockKV.get).toHaveBeenCalledTimes(1);

      // Verify both results are the same
      expect(ips1).toBe(ips2);
    });
  });

  describe("Hosts File Loader", () => {
    test("should load and parse hosts file from KV", async () => {
      // Setup mock KV response
      const mockHosts =
        "127.0.0.1 localhost\n# Comment\n192.168.1.1 router.local admin.router.local\n\n10.0.0.1 nas.local";
      mockKV.get.mockResolvedValue(mockHosts);

      const hosts = await loadHostsFile("hosts", mockEnv);

      // Verify KV was called
      expect(mockKV.get).toHaveBeenCalledWith("hosts");

      // Verify hosts were parsed correctly (ignoring comments and empty lines)
      expect(Object.keys(hosts).length).toBe(4);
      expect(hosts["localhost"]).toBe("127.0.0.1");
      expect(hosts["router.local"]).toBe("192.168.1.1");
      expect(hosts["admin.router.local"]).toBe("192.168.1.1");
      expect(hosts["nas.local"]).toBe("10.0.0.1");
    });

    test("should use cached hosts file when available", async () => {
      // First call - load from KV
      mockKV.get.mockResolvedValue("127.0.0.1 localhost");
      const hosts1 = await loadHostsFile("hosts", mockEnv);

      // Second call - should use cache
      const hosts2 = await loadHostsFile("hosts", mockEnv);

      // Verify KV was called only once
      expect(mockKV.get).toHaveBeenCalledTimes(1);

      // Verify both results are the same
      expect(hosts1).toBe(hosts2);
    });
  });

  describe("Cache Management", () => {
    test("should clear specific cache type", async () => {
      // Load data into different caches
      mockKV.get.mockResolvedValueOnce("example.com");
      mockKV.get.mockResolvedValueOnce("192.168.1.1");
      mockKV.get.mockResolvedValueOnce("127.0.0.1 localhost");

      await loadDomainList("domains", mockEnv);
      await loadIPList("ips", mockEnv);
      await loadHostsFile("hosts", mockEnv);

      // Verify all caches have data
      expect(getCacheStats().domains).toBe(1);
      expect(getCacheStats().ips).toBe(1);
      expect(getCacheStats().hosts).toBe(1);

      // Clear only domain cache
      clearCache("domains");

      // Verify only domain cache was cleared
      expect(getCacheStats().domains).toBe(0);
      expect(getCacheStats().ips).toBe(1);
      expect(getCacheStats().hosts).toBe(1);
    });

    test("should clear all caches", async () => {
      // Load data into different caches
      mockKV.get.mockResolvedValueOnce("example.com");
      mockKV.get.mockResolvedValueOnce("192.168.1.1");
      mockKV.get.mockResolvedValueOnce("127.0.0.1 localhost");

      await loadDomainList("domains", mockEnv);
      await loadIPList("ips", mockEnv);
      await loadHostsFile("hosts", mockEnv);

      // Verify all caches have data
      expect(getCacheStats().domains).toBe(1);
      expect(getCacheStats().ips).toBe(1);
      expect(getCacheStats().hosts).toBe(1);

      // Clear all caches
      clearCache();

      // Verify all caches were cleared
      expect(getCacheStats().domains).toBe(0);
      expect(getCacheStats().ips).toBe(0);
      expect(getCacheStats().hosts).toBe(0);
    });

    test("should return cache statistics", async () => {
      // Load data into different caches
      mockKV.get.mockResolvedValueOnce("example.com\ntest.org");
      mockKV.get.mockResolvedValueOnce("192.168.1.1\n10.0.0.1");

      await loadDomainList("domains1", mockEnv);
      await loadDomainList("domains2", mockEnv);
      await loadIPList("ips", mockEnv);

      // Verify cache stats
      const stats = getCacheStats();
      expect(stats.domains).toBe(2);
      expect(stats.ips).toBe(1);
      expect(stats.hosts).toBe(0);
    });
  });
});
