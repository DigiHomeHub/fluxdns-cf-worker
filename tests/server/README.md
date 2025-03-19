# Server Integration Tests

This directory contains integration tests that validate the FluxDNS application against a running wrangler development server.

## Prerequisites

Before running these tests, you need to:

1. Install dependencies:

   ```
   npm install
   ```

2. Start the wrangler development server:
   ```
   npm run dev
   ```
   or
   ```
   wrangler dev --local
   ```

## Running the Tests

Once the server is running, you can execute the integration tests with:

```
npm run test:server
```

## Test Structure

The integration tests are organized as follows:

- `doh-get.test.js` - Tests DNS-over-HTTPS GET method (base64url-encoded queries)
- `doh-post.test.js` - Tests DNS-over-HTTPS POST method (binary queries)
- `doh-json.test.js` - Tests DNS-over-HTTPS JSON API method (name parameter queries)

Each test file will first check if the local server is running, and will output a warning if it isn't.

## Troubleshooting

If tests are failing, check that:

1. The wrangler server is running on the default port (8787)
2. The server has proper network connectivity to make upstream DNS requests
3. You have the correct dependencies installed (`node-fetch` is required)

## Example Commands

Testing specific endpoints:

```
# Test only GET requests
npx jest tests/server/doh-get.test.js

# Test only POST requests
npx jest tests/server/doh-post.test.js

# Test only JSON requests
npx jest tests/server/doh-json.test.js
```
