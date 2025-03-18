/**
 * Forward Plugin
 *
 * Forwards DNS queries to upstream DNS servers using DNS over HTTPS.
 */

import { registerPlugin } from "../core/plugin-chain";

/**
 * Register the forward plugin
 */
export function register() {
  registerPlugin("forward", executeForward);
}

/**
 * Execute the forward plugin
 *
 * @param {DnsContext} ctx - DNS request context
 * @param {Object} args - Plugin arguments
 * @returns {Promise<boolean>} True if successful
 */
export async function executeForward(ctx, args) {
  const {
    upstream = "https://doh.pub/dns-query",
    timeout = 5000,
    edns_client_subnet = false,
    use_http = false,
    headers = {},
  } = args;

  try {
    // Normalize the upstream URL
    let upstreamUrl = upstream;
    if (!upstreamUrl.startsWith("http")) {
      upstreamUrl = `https://${upstreamUrl}/dns-query`;
    }

    // Save upstream used for metrics
    ctx.metadata.upstream = upstreamUrl;

    // Prepare fetch options
    const fetchOptions = {
      method: "POST",
      headers: {
        Accept: "application/dns-message",
        "Content-Type": "application/dns-message",
        ...headers,
      },
      body: ctx.dnsMessage,
      cf: { cacheTtl: 300 }, // Use Cloudflare edge cache when possible
    };

    // Set up request timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort("DNS query timeout"),
      timeout
    );
    fetchOptions.signal = controller.signal;

    // Add EDNS Client Subnet if requested
    if (
      edns_client_subnet &&
      ctx.metadata.clientInfo &&
      ctx.metadata.clientInfo.ip
    ) {
      // In a real implementation, we would modify the DNS query to include ECS
      // This would require more complex DNS message manipulation
      console.log("Would add ECS for client IP:", ctx.metadata.clientInfo.ip);
    }

    // Execute the fetch
    console.log("Fetching from:", upstreamUrl);
    console.log("Fetch options:", fetchOptions);
    const response = await fetch(upstreamUrl, fetchOptions);
    clearTimeout(timeoutId);

    // Check for error responses
    if (!response.ok) {
      throw new Error(
        `Upstream DNS server returned ${response.status}: ${response.statusText}`
      );
    }

    // Process the response
    const responseBuffer = await response.arrayBuffer();

    // Set response on context
    ctx.setResponse(responseBuffer);

    // Record response time
    // TODO: Add response time recording
    // ctx.metadata.stats.upstreamResponseTime =
    //   Date.now() - ctx.metadata.timings.start;

    return true;
  } catch (error) {
    console.error("Error in forward plugin:", error);

    // Record error
    ctx.metadata.upstreamError = error.message;

    // Don't set an error response, let other plugins handle it
    // or let the default error handler kick in
    return false;
  }
}
