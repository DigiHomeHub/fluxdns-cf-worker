/**
 * Unit tests for the plugin chain system
 *
 * These tests verify the complete functionality of the plugin chain
 * including registration, chain creation, execution, conditional logic,
 * and error handling.
 */

import { jest } from "@jest/globals";
import {
  registerPlugin,
  createPluginChain,
  loadPlugins,
} from "../../src/core/plugin-chain.js";

// Mock console methods to prevent test output pollution
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Mock DNS context class for testing
class MockDnsContext {
  constructor() {
    this.metadata = {
      timings: {},
      errors: [],
      tags: [],
    };
    this.resolved = false;
  }

  addTag(tag) {
    if (!this.metadata.tags) {
      this.metadata.tags = [];
    }
    this.metadata.tags.push(tag);
  }

  hasTag(tag) {
    return this.metadata.tags && this.metadata.tags.includes(tag);
  }
}

// Mock dynamic imports
jest.mock(
  "../plugins/cache.js",
  () => ({
    register: jest.fn(),
  }),
  { virtual: true }
);

jest.mock(
  "../plugins/forward.js",
  () => ({
    register: jest.fn(),
  }),
  { virtual: true }
);

jest.mock(
  "../plugins/hosts.js",
  () => ({
    register: jest.fn(),
  }),
  { virtual: true }
);

jest.mock(
  "../plugins/matcher.js",
  () => ({
    register: jest.fn(),
  }),
  { virtual: true }
);

jest.mock(
  "../plugins/redirect.js",
  () => ({
    register: jest.fn(),
  }),
  { virtual: true }
);

jest.mock(
  "../plugins/response-modifier.js",
  () => ({
    register: jest.fn(),
  }),
  { virtual: true }
);

describe("Plugin Chain", () => {
  // Setup and teardown
  beforeEach(() => {
    // Mock console methods
    console.warn = jest.fn();
    console.error = jest.fn();

    // Clear all registered plugins by resetting modules
    jest.resetModules();

    // Register test plugins
    registerPlugin("test_plugin", async (ctx, args) => {
      ctx.metadata.testPlugin = true;
      return true;
    });

    registerPlugin("error_plugin", async (ctx, args) => {
      throw new Error("Test error");
    });

    registerPlugin("resolver_plugin", async (ctx, args) => {
      ctx.resolved = true;
      return true;
    });

    registerPlugin("args_plugin", async (ctx, args) => {
      ctx.metadata.args = args;
      return true;
    });
  });

  afterEach(() => {
    // Restore console methods
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });

  // Plugin registration tests
  describe("registerPlugin", () => {
    test("should register a valid plugin handler", () => {
      // Should not throw error for valid handler
      expect(() => {
        registerPlugin("valid_plugin", async () => true);
      }).not.toThrow();
    });

    test("should throw error for non-function handler", () => {
      // Should throw for non-function handler
      expect(() => {
        registerPlugin("invalid_plugin", "not a function");
      }).toThrow("Plugin handler for invalid_plugin must be a function");
    });
  });

  // Plugin chain creation tests
  describe("createPluginChain", () => {
    test("should create a valid chain with proper methods", () => {
      const plugins = [{ type: "test_plugin", tag: "test1" }];

      const chain = createPluginChain(plugins);
      expect(chain).toBeDefined();
      expect(typeof chain.execute).toBe("function");
      expect(typeof chain.getPlugins).toBe("function");
    });

    test("should throw error for non-array plugin configuration", () => {
      expect(() => {
        createPluginChain("not an array");
      }).toThrow("Plugin configuration must be an array");
    });

    test("should skip plugins with invalid type and log warning", () => {
      const plugins = [
        { type: "non_existent_plugin", tag: "test1" },
        { type: "test_plugin", tag: "test2" },
      ];

      const chain = createPluginChain(plugins);
      const chainPlugins = chain.getPlugins();

      // Should only include valid plugins
      expect(chainPlugins).toHaveLength(1);
      expect(chainPlugins[0].tag).toBe("test2");

      // Should log warning for invalid plugin type
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Plugin type "non_existent_plugin" not found in registry'
        )
      );
    });

    test("should create empty chain for empty plugins array", () => {
      const chain = createPluginChain([]);
      expect(chain.getPlugins()).toHaveLength(0);
    });

    test("should handle plugin args correctly", () => {
      const plugins = [
        {
          type: "args_plugin",
          tag: "test_args",
          args: { key1: "value1", key2: 42 },
        },
      ];

      const chain = createPluginChain(plugins);
      const ctx = new MockDnsContext();

      chain.execute(ctx);

      expect(ctx.metadata.args).toEqual({ key1: "value1", key2: 42 });
    });
  });

  // Plugin chain execution tests
  describe("Plugin Chain Execution", () => {
    test("should execute plugins in order", async () => {
      const executionOrder = [];

      registerPlugin("plugin1", async (ctx) => {
        executionOrder.push("plugin1");
        return true;
      });

      registerPlugin("plugin2", async (ctx) => {
        executionOrder.push("plugin2");
        return true;
      });

      registerPlugin("plugin3", async (ctx) => {
        executionOrder.push("plugin3");
        return true;
      });

      const plugins = [
        { type: "plugin1", tag: "first" },
        { type: "plugin2", tag: "second" },
        { type: "plugin3", tag: "third" },
      ];

      const chain = createPluginChain(plugins);
      const ctx = new MockDnsContext();

      await chain.execute(ctx);

      expect(executionOrder).toEqual(["plugin1", "plugin2", "plugin3"]);
    });

    test("should initialize context metadata if missing", async () => {
      const plugins = [{ type: "test_plugin", tag: "test1" }];

      const chain = createPluginChain(plugins);

      // Create context without metadata
      const ctx = {};

      await chain.execute(ctx);

      // Should initialize all required metadata fields
      expect(ctx.metadata).toBeDefined();
      expect(ctx.metadata.timings).toBeDefined();
      expect(ctx.metadata.errors).toBeDefined();
      expect(ctx.metadata.tags).toBeDefined();
    });

    test("should stop execution when resolved is set", async () => {
      const executionOrder = [];

      registerPlugin("plugin1", async (ctx) => {
        executionOrder.push("plugin1");
        return true;
      });

      registerPlugin("resolver", async (ctx) => {
        executionOrder.push("resolver");
        ctx.resolved = true;
        return true;
      });

      registerPlugin("plugin3", async (ctx) => {
        executionOrder.push("plugin3");
        return true;
      });

      const plugins = [
        { type: "plugin1", tag: "first" },
        { type: "resolver", tag: "second" },
        { type: "plugin3", tag: "third" },
      ];

      const chain = createPluginChain(plugins);
      const ctx = new MockDnsContext();

      await chain.execute(ctx);

      // Should not execute plugin3
      expect(executionOrder).toEqual(["plugin1", "resolver"]);
      expect(executionOrder).not.toContain("plugin3");
    });

    test("should add tag to context when plugin returns true", async () => {
      registerPlugin("true_plugin", async () => true);
      registerPlugin("false_plugin", async () => false);

      const plugins = [
        { type: "true_plugin", tag: "should_be_tagged" },
        { type: "false_plugin", tag: "should_not_be_tagged" },
      ];

      const chain = createPluginChain(plugins);
      const ctx = new MockDnsContext();

      await chain.execute(ctx);

      // Should only add tag for true_plugin
      expect(ctx.metadata.tags).toContain("should_be_tagged");
      expect(ctx.metadata.tags).not.toContain("should_not_be_tagged");
    });

    test("should record execution time for each plugin", async () => {
      // Create plugins with deterministic execution time
      registerPlugin("slow_plugin", async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return true;
      });

      const plugins = [
        { type: "test_plugin", tag: "fast" },
        { type: "slow_plugin", tag: "slow" },
      ];

      const chain = createPluginChain(plugins);
      const ctx = new MockDnsContext();

      await chain.execute(ctx);

      // Should record execution time for both plugins
      expect(ctx.metadata.timings.fast).toBeDefined();
      expect(ctx.metadata.timings.slow).toBeDefined();

      // Slow plugin should take longer
      expect(ctx.metadata.timings.slow).toBeGreaterThan(0);
    });
  });

  // Conditional execution tests
  describe("Conditional Execution", () => {
    test("should respect if_matched condition", async () => {
      const executionOrder = [];

      registerPlugin("plugin1", async (ctx) => {
        executionOrder.push("plugin1");
        ctx.addTag("condition_a");
        return true;
      });

      registerPlugin("plugin2", async (ctx) => {
        executionOrder.push("plugin2");
        return true;
      });

      const plugins = [
        { type: "plugin1", tag: "first" },
        { type: "plugin2", tag: "second", if_matched: "condition_a" },
      ];

      const chain = createPluginChain(plugins);
      const ctx = new MockDnsContext();

      await chain.execute(ctx);

      // Should execute both plugins because condition_a is set by plugin1
      expect(executionOrder).toEqual(["plugin1", "plugin2"]);
    });

    test("should respect if_not_matched condition", async () => {
      const executionOrder = [];

      registerPlugin("plugin1", async (ctx) => {
        executionOrder.push("plugin1");
        ctx.addTag("condition_a");
        return true;
      });

      registerPlugin("plugin2", async (ctx) => {
        executionOrder.push("plugin2");
        return true;
      });

      registerPlugin("plugin3", async (ctx) => {
        executionOrder.push("plugin3");
        return true;
      });

      const plugins = [
        { type: "plugin1", tag: "first" },
        { type: "plugin2", tag: "second", if_not_matched: "condition_a" },
        { type: "plugin3", tag: "third", if_not_matched: "condition_b" },
      ];

      const chain = createPluginChain(plugins);
      const ctx = new MockDnsContext();

      await chain.execute(ctx);

      // Should skip plugin2 (condition_a is matched) but execute plugin3 (condition_b is not matched)
      expect(executionOrder).toEqual(["plugin1", "plugin3"]);
      expect(executionOrder).not.toContain("plugin2");
    });

    test("should handle both if_matched and if_not_matched conditions", async () => {
      const executionOrder = [];

      registerPlugin("setup", async (ctx) => {
        executionOrder.push("setup");
        ctx.addTag("tag_a");
        return true;
      });

      registerPlugin("plugin1", async (ctx) => {
        executionOrder.push("plugin1");
        return true;
      });

      registerPlugin("plugin2", async (ctx) => {
        executionOrder.push("plugin2");
        return true;
      });

      registerPlugin("plugin3", async (ctx) => {
        executionOrder.push("plugin3");
        return true;
      });

      const plugins = [
        { type: "setup", tag: "setup" },
        // Execute if tag_a is present AND tag_b is not present
        {
          type: "plugin1",
          tag: "p1",
          if_matched: "tag_a",
          if_not_matched: "tag_b",
        },
        // Execute if tag_a is present AND tag_a is not present (impossible)
        {
          type: "plugin2",
          tag: "p2",
          if_matched: "tag_a",
          if_not_matched: "tag_a",
        },
        // Execute if tag_b is present AND tag_c is not present
        {
          type: "plugin3",
          tag: "p3",
          if_matched: "tag_b",
          if_not_matched: "tag_c",
        },
      ];

      const chain = createPluginChain(plugins);
      const ctx = new MockDnsContext();

      await chain.execute(ctx);

      // Only plugin1 should execute (tag_a is present, tag_b is not)
      expect(executionOrder).toEqual(["setup", "plugin1"]);
      expect(executionOrder).not.toContain("plugin2");
      expect(executionOrder).not.toContain("plugin3");
    });
  });

  // Error handling tests
  describe("Error Handling", () => {
    test("should continue execution after plugin error", async () => {
      const executionOrder = [];

      registerPlugin("plugin1", async (ctx) => {
        executionOrder.push("plugin1");
        return true;
      });

      registerPlugin("error_plugin", async (ctx) => {
        throw new Error("Test error");
      });

      registerPlugin("plugin3", async (ctx) => {
        executionOrder.push("plugin3");
        return true;
      });

      const plugins = [
        { type: "plugin1", tag: "first" },
        { type: "error_plugin", tag: "error" },
        { type: "plugin3", tag: "third" },
      ];

      const chain = createPluginChain(plugins);
      const ctx = new MockDnsContext();

      await chain.execute(ctx);

      // Should continue after error
      expect(executionOrder).toEqual(["plugin1", "plugin3"]);
    });

    test("should log error message and record error in context", async () => {
      const plugins = [{ type: "error_plugin", tag: "error" }];

      const chain = createPluginChain(plugins);
      const ctx = new MockDnsContext();

      await chain.execute(ctx);

      // Should log error
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Error executing plugin error"),
        expect.any(Error)
      );

      // Should record error in context
      expect(ctx.metadata.errors).toHaveLength(1);
      expect(ctx.metadata.errors[0]).toEqual({
        plugin: "error",
        error: "Test error",
      });
    });

    test("should initialize errors array if missing", async () => {
      const plugins = [{ type: "error_plugin", tag: "error" }];

      const chain = createPluginChain(plugins);
      const ctx = {
        metadata: {}, // No errors array
        addTag: jest.fn(),
        hasTag: jest.fn(),
      };

      await chain.execute(ctx);

      // Should initialize errors array and record error
      expect(Array.isArray(ctx.metadata.errors)).toBe(true);
      expect(ctx.metadata.errors).toHaveLength(1);
    });
  });

  // Plugin loading tests
  describe("Plugin Loading", () => {
    // We can't fully test loadPlugins without mocking dynamic imports
    // which is challenging in the Jest environment, but we can test
    // that it doesn't throw errors

    test("should not throw errors when loading plugins", async () => {
      // Simply verify the function doesn't throw
      await expect(loadPlugins()).resolves.not.toThrow();
    });
  });
});
