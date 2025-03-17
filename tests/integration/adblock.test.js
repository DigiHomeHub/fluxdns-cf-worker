/**
 * Integration test for ad blocking functionality
 *
 * Tests the ad blocking capabilities using the matcher plugin.
 */

import { jest } from "@jest/globals";
import { DnsContext } from "../../src/core/context.js";
import {
  createPluginChain,
  registerPlugin,
} from "../../src/core/plugin-chain.js";
import { RRType, RCODE } from "../../src/core/types.js";

// Mock DNS context - 简化版的测试上下文
class MockDnsContext {
  constructor(domain, type = "A") {
    this.domain = domain;
    this.type = type;
    this.resolved = false;
    this.error = null;
    this.metadata = {
      tags: [],
    };
    this.response = null;
  }

  getQueryDomain() {
    return this.domain;
  }

  getQueryType() {
    return this.type;
  }

  setError(rcode) {
    this.error = rcode;
  }

  addTag(tag) {
    this.metadata.tags.push(tag);
  }

  hasTag(tag) {
    return this.metadata.tags.includes(tag);
  }

  setResponse(response) {
    this.response = response;
  }
}

describe("Ad Blocking Test", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // 注册测试所需的插件
    registerPlugin("adblock", async (ctx, args) => {
      const domain = ctx.getQueryDomain();

      // 检查域名是否包含广告关键词
      const adKeywords = ["ads", "tracker", "analytics"];
      const isAdDomain = adKeywords.some((keyword) => domain.includes(keyword));

      if (isAdDomain) {
        // 应用自定义RCODE，如果提供的话
        ctx.setError(args.rcode || RCODE.NXDOMAIN);
        ctx.resolved = true;
        ctx.addTag("adblock_filtered");
        return true;
      }

      return false;
    });

    registerPlugin("forward", async (ctx, args) => {
      ctx.metadata = ctx.metadata || {};
      ctx.metadata.upstream =
        args.upstream || "https://cloudflare-dns.com/dns-query";
      ctx.response = new ArrayBuffer(10); // 模拟响应
      ctx.resolved = true;
      ctx.addTag("forwarded");
      return true;
    });
  });

  test("blocks ad domains and forwards normal domains", async () => {
    // 创建插件链
    const plugins = [
      {
        type: "adblock",
        tag: "ad_blocker",
      },
      {
        type: "forward",
        tag: "dns_forward",
        upstream: "https://cloudflare-dns.com/dns-query",
      },
    ];

    const chain = createPluginChain(plugins);

    // 测试广告域名
    const adCtx = new MockDnsContext("ads.example.com");
    await chain.execute(adCtx);

    // 验证广告域名被拦截
    expect(adCtx.error).toBe(RCODE.NXDOMAIN);
    expect(adCtx.resolved).toBe(true);
    expect(adCtx.hasTag("adblock_filtered")).toBe(true);

    // 测试跟踪器域名
    const trackerCtx = new MockDnsContext("tracker.example.com");
    await chain.execute(trackerCtx);

    // 验证跟踪器域名被拦截
    expect(trackerCtx.error).toBe(RCODE.NXDOMAIN);
    expect(trackerCtx.resolved).toBe(true);
    expect(trackerCtx.hasTag("adblock_filtered")).toBe(true);

    // 测试分析域名
    const analyticsCtx = new MockDnsContext("analytics.example.com");
    await chain.execute(analyticsCtx);

    // 验证分析域名被拦截
    expect(analyticsCtx.error).toBe(RCODE.NXDOMAIN);
    expect(analyticsCtx.resolved).toBe(true);
    expect(analyticsCtx.hasTag("adblock_filtered")).toBe(true);

    // 测试正常域名
    const normalCtx = new MockDnsContext("example.com");
    await chain.execute(normalCtx);

    // 验证正常域名被转发
    expect(normalCtx.error).toBe(null);
    expect(normalCtx.resolved).toBe(true);
    expect(normalCtx.hasTag("forwarded")).toBe(true);
  });

  test("should use custom RCODE if provided", async () => {
    // 创建插件链，使用自定义的RCODE
    const plugins = [
      {
        type: "adblock",
        tag: "ad_blocker",
        args: {
          rcode: RCODE.REFUSED, // 使用REFUSED而不是NXDOMAIN
        },
      },
    ];

    const chain = createPluginChain(plugins);

    // 创建测试上下文
    const ctx = new MockDnsContext("ads.example.com");

    // 执行插件链
    await chain.execute(ctx);

    // 验证使用了自定义的RCODE
    expect(ctx.resolved).toBe(true);
    expect(ctx.error).toBe(RCODE.REFUSED);
    expect(ctx.hasTag("adblock_filtered")).toBe(true);
  });
});
