/**
 * Jest setup file
 *
 * This file is loaded before tests are run and sets up the testing environment.
 */

import { jest } from "@jest/globals";

// Mock global objects that are available in Cloudflare Workers
global.caches = {
  default: {
    match: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
};

// Mock fetch
global.fetch = jest.fn();

// Mock Request
global.Request = jest.fn().mockImplementation((url, init = {}) => {
  const headers = new Map();
  if (init.headers) {
    Object.entries(init.headers).forEach(([key, value]) => {
      headers.set(key.toLowerCase(), value);
    });
  }

  return {
    url,
    method: init.method || "GET",
    headers: {
      get: (name) => headers.get(name.toLowerCase()),
      has: (name) => headers.has(name.toLowerCase()),
      set: (name, value) => headers.set(name.toLowerCase(), value),
    },
    json: () => Promise.resolve(init.body ? JSON.parse(init.body) : {}),
    text: () => Promise.resolve(init.body || ""),
    arrayBuffer: () => Promise.resolve(init.body || new ArrayBuffer(0)),
  };
});

// Mock URL - use a simple implementation to avoid recursion
const originalURL = global.URL;
global.URL = jest.fn().mockImplementation((url) => {
  return {
    searchParams: {
      get: (name) => {
        // Simple parsing of query parameters
        const match = url.match(new RegExp(`[?&]${name}=([^&]*)`));
        return match ? match[1] : null;
      },
    },
  };
});

// Mock Response
global.Response = jest.fn().mockImplementation((body, init) => {
  return {
    body,
    status: init?.status || 200,
    headers: new Map(Object.entries(init?.headers || {})),
    clone: function () {
      return this;
    },
    arrayBuffer: function () {
      return Promise.resolve(body);
    },
    text: function () {
      return Promise.resolve(
        typeof body === "string" ? body : "Mock Response Text"
      );
    },
    json: function () {
      if (typeof body === "string") {
        try {
          return Promise.resolve(JSON.parse(body));
        } catch (e) {
          return Promise.resolve({});
        }
      }
      return Promise.resolve(typeof body === "object" ? body : {});
    },
  };
});

// Mock console methods for testing
const originalConsoleError = console.error;
console.error = jest.fn((...args) => {
  // Still log errors during test development, but could be silenced in CI
  originalConsoleError(...args);
});

const originalConsoleWarn = console.warn;
console.warn = jest.fn((...args) => {
  // Still log warnings during test development, but could be silenced in CI
  originalConsoleWarn(...args);
});

// Reset all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});
