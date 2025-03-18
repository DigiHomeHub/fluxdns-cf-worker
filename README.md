# FluxDNS Cloudflare Worker

A flexible DNS-over-HTTPS (DoH) proxy implemented as a Cloudflare Worker, with support for conditional forwarding, ad blocking, and custom DNS resolution.

## Features

- **Plugin-based Architecture**: Easily extend functionality with custom plugins
- **Conditional Forwarding**: Route DNS queries to different upstream resolvers based on domain patterns
- **Ad Blocking**: Block ads, trackers, and malicious domains using blocklists
- **Custom DNS Resolution**: Define custom DNS responses for specific domains
- **Metrics and Logging**: Track performance and query patterns
- **Cloudflare Worker**: Deploy globally with low latency

## Getting Started

### Prerequisites

- Node.js 16 or higher
- Wrangler CLI (Cloudflare Workers CLI)
- Cloudflare account

### Installation

1. Clone the repository:

```bash
git clone https://github.com/DigiHomeHub/fluxdns-cf-worker.git
cd fluxdns-cf-worker
```

2. Install dependencies:

```bash
npm install
```

3. Configure your DNS settings in `config.js`.

### Development

Run the development server:

```bash
npm run dev
```

### Testing

Run the test suite:

```bash
npm test
```

Run unit tests only:

```bash
npm run test:unit
```

Run integration tests only:

```bash
npm run test:integration
```

### Deployment

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

## Configuration

FluxDNS is configured through a plugin chain defined in your `wrangler.toml` file or environment variables. Here's an example configuration:

```js
// Example configuration
const config = {
  plugins: [
    // Match private domains
    {
      type: "matcher",
      tag: "match_private",
      pattern: /\.(local|internal)$/,
      match_subdomains: true,
    },
    // Forward private domains to internal DNS
    {
      type: "forwarder",
      tag: "private_dns",
      if_matched: "match_private",
      upstream: "https://private.dns.server/dns-query",
    },
    // Block ads and trackers
    {
      type: "matcher",
      tag: "match_ads",
      pattern: /^(ads|tracker|analytics)\./,
      match_subdomains: true,
      action: "reject",
    },
    // Default forwarder for all other domains
    {
      type: "forwarder",
      tag: "default_dns",
      upstream: "https://security.cloudflare-dns.com/dns-query",
    },
  ],
};
```

## Plugin System

FluxDNS uses a flexible plugin system. Each plugin is a function that receives a context object and can modify it. Plugins are executed in order, and can conditionally execute based on tags set by previous plugins.

### Built-in Plugins

- **matcher**: Match domains against patterns and tag the context
- **forwarder**: Forward DNS queries to upstream resolvers
- **cache**: Cache DNS responses
- **hosts**: Resolve domains using a hosts-like configuration
- **redirect**: Redirect DNS queries to different domains
- **response-modifier**: Modify DNS responses

### Creating Custom Plugins

You can create custom plugins by implementing the plugin interface:

```js
registerPlugin("my_plugin", async (ctx, args) => {
  // Implement your plugin logic here
  // ctx is the DNS context object
  // args are the plugin arguments from configuration

  // Return true if the plugin should tag the context
  return true;
});
```

## Testing

FluxDNS includes a comprehensive test suite to ensure functionality and stability. The tests are organized into several categories:

### Unit Tests

Unit tests verify the functionality of individual components in isolation:

- **Core Components**: Tests for DNS message parsing, plugin chain execution, and context handling.
- **Plugins**: Tests for individual plugins like matchers, cache, and forwarders.

### Integration Tests

Integration tests verify how components work together:

- **Basic Flow**: Tests the basic DNS request flow through the system.
- **Caching Flow**: Tests the DNS caching functionality.
- **Conditional Forwarding**: Tests the conditional forwarding based on domain patterns.
- **Ad Blocking**: Tests the ad-blocking functionality.
- **Full Chain**: Tests the complete plugin chain with multiple plugins.

### Running Tests

To run the tests:

```bash
# Run all tests
npm test

# Run specific test categories
npm test -- --testPathPattern=integration
npm test -- --testPathPattern=unit

# Run tests while ignoring specific directories
npm test -- --testPathIgnorePatterns=tests/server/
```

### Test Coverage

The test suite covers:

- DNS message parsing and serialization
- Plugin registration and execution
- Plugin chain conditional execution
- Error handling in plugins
- Cache hit/miss scenarios
- Domain pattern matching
- Conditional forwarding based on domain patterns

## Deployment

To deploy FluxDNS to Cloudflare Workers:

1. Configure your `wrangler.toml` file with your account details
2. Run the deployment command:

```bash
npm run deploy
```

This will build and deploy the worker to your Cloudflare account.

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Cloudflare Workers for providing the serverless platform
- DNS-over-HTTPS specification (RFC 8484)
- [MosDNS](https://github.com/IrineSistiana/mosdns)
