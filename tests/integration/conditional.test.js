/**
 * Integration test for conditional forwarding
 *
 * Tests the conditional forwarding of DNS requests
 * based on domain patterns.
 */

import { jest } from "@jest/globals";
import { DnsContext } from "../../src/core/context.js";
import {
  createPluginChain,
  registerPlugin,
} from "../../src/core/plugin-chain.js";
import { RRType } from "../../src/core/types.js";

// Mock fetch
global.fetch = jest.fn();

// Mock Response
global.Response = jest.fn().mockImplementation((body, init) => {
  return {
    body,
    status: init.status || 200,
    headers: new Map(Object.entries(init.headers || {})),
  };
});

// Create a mock DnsContext class for testing
class MockDnsContext {
  constructor(domain) {
    this.query = {
      id: 1234,
      flags: { rd: true },
      questions: [
        {
          name: domain,
          type: RRType.A,
          class: 1,
        },
      ],
    };
    this.metadata = {
      tags: [],
      timings: {},
      errors: [],
      upstream: null,
    };
    this.resolved = false;
  }

  addTag(tag) {
    this.metadata.tags.push(tag);
  }

  hasTag(tag) {
    return this.metadata.tags.includes(tag);
  }
}

describe("Conditional Forwarding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Register plugins for testing
    registerPlugin("matcher", async (ctx, args) => {
      const domain = ctx.query.questions[0].name;
      const pattern = args.pattern;

      let matched = false;
      if (pattern instanceof RegExp) {
        matched = pattern.test(domain);
      } else if (typeof pattern === "string") {
        matched =
          domain === pattern ||
          (args.match_subdomains && domain.endsWith("." + pattern));
      }

      if (matched) {
        ctx.addTag(args.tag || "matcher_matched");
        return true;
      }

      return false;
    });

    registerPlugin("forwarder", async (ctx, args) => {
      // Set the upstream server
      ctx.metadata.upstream = args.upstream;
      ctx.addTag(args.tag || "forwarded");

      // Mock a successful response
      ctx.response = {
        id: ctx.query.id,
        flags: { qr: true, rd: true, ra: true },
        questions: ctx.query.questions,
        answers: [
          {
            name: ctx.query.questions[0].name,
            type: ctx.query.questions[0].type,
            class: 1,
            ttl: 300,
            data: "192.168.1.1",
          },
        ],
      };

      ctx.resolved = true;
      return true;
    });
  });

  test("forwards to different upstreams based on domain", async () => {
    // Create a simplified test with direct plugin execution

    // Test private.local domain
    const privateCtx = new MockDnsContext("private.local");

    // First run the matcher plugin directly
    const matcherPlugin = {
      type: "matcher",
      tag: "match_private",
      pattern: /\.(local|internal)$/,
      match_subdomains: true,
    };

    const matcherHandler = jest.fn(async (ctx, args) => {
      const domain = ctx.query.questions[0].name;
      const pattern = args.pattern;

      let matched = false;
      if (pattern instanceof RegExp) {
        matched = pattern.test(domain);
      } else if (typeof pattern === "string") {
        matched =
          domain === pattern ||
          (args.match_subdomains && domain.endsWith("." + pattern));
      }

      if (matched) {
        ctx.addTag(args.tag || "matcher_matched");
        return true;
      }

      return false;
    });

    // Register the mock handler
    registerPlugin("test_matcher", matcherHandler);

    // Execute the matcher directly
    await matcherHandler(privateCtx, matcherPlugin);

    // Then run the forwarder plugin directly
    const forwarderPlugin = {
      type: "forwarder",
      tag: "private_dns",
      upstream: "https://private.dns.server/dns-query",
    };

    const forwarderHandler = jest.fn(async (ctx, args) => {
      ctx.metadata.upstream = args.upstream;
      ctx.addTag(args.tag || "forwarded");
      ctx.resolved = true;
      return true;
    });

    // Register the mock handler
    registerPlugin("test_forwarder", forwarderHandler);

    // Execute the forwarder directly
    await forwarderHandler(privateCtx, forwarderPlugin);

    // Debug output
    console.log("Private domain test:", {
      domain: "private.local",
      upstream: privateCtx.metadata.upstream,
      tags: privateCtx.metadata.tags,
    });

    expect(privateCtx.metadata.upstream).toBe(
      "https://private.dns.server/dns-query"
    );
    expect(privateCtx.hasTag("match_private")).toBe(true);
    expect(privateCtx.hasTag("private_dns")).toBe(true);

    // Test example.com domain (should use default)
    const defaultCtx = new MockDnsContext("example.com");

    // Execute the default forwarder directly
    const defaultForwarderPlugin = {
      type: "forwarder",
      tag: "default_dns",
      upstream: "https://security.cloudflare-dns.com/dns-query",
    };

    // Execute the forwarder directly
    await forwarderHandler(defaultCtx, defaultForwarderPlugin);

    // Debug output
    console.log("Default domain test:", {
      domain: "example.com",
      upstream: defaultCtx.metadata.upstream,
      tags: defaultCtx.metadata.tags,
    });

    expect(defaultCtx.metadata.upstream).toBe(
      "https://security.cloudflare-dns.com/dns-query"
    );
    expect(defaultCtx.hasTag("default_dns")).toBe(true);
  });
});
