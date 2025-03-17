/**
 * Hosts Plugin
 * 
 * Implements local DNS resolution similar to a hosts file.
 * Allows specifying static A/AAAA records for domains.
 */

import { registerPlugin } from '../core/plugin-chain';
import { RRType, RCODE } from '../core/types';
import { normalizeDomain } from '../utils/dns-util';

/**
 * Register the hosts plugin
 */
export function register() {
  registerPlugin('hosts', executeHosts);
}

/**
 * Execute the hosts plugin
 * 
 * @param {DnsContext} ctx - DNS request context
 * @param {Object} args - Plugin arguments
 * @returns {Promise<boolean>} True if the request was handled
 */
export async function executeHosts(ctx, args) {
  const {
    hosts = {},         // Map of domain -> IP(s)
    ttl = 300,          // TTL for responses
    passThrough = true  // Whether to pass through unmatched domains
  } = args;
  
  try {
    // Get query domain and type
    const queryDomain = ctx.getQueryDomain();
    const queryType = ctx.getQueryType();
    
    if (!queryDomain) {
      return false;
    }
    
    // Normalize the query domain
    const normalizedDomain = normalizeDomain(queryDomain);
    
    // Only handle A and AAAA queries
    if (queryType !== RRType.A && queryType !== RRType.AAAA) {
      return false;
    }
    
    // Check if we have a hosts entry for this domain
    if (!hosts[normalizedDomain]) {
      return false;
    }
    
    // Get the IP address(es) for this domain
    let ips = hosts[normalizedDomain];
    if (!Array.isArray(ips)) {
      ips = [ips];
    }
    
    // Filter IPs based on query type (IPv4 for A, IPv6 for AAAA)
    const filteredIps = ips.filter(ip => {
      const isIPv6 = ip.includes(':');
      return (queryType === RRType.A && !isIPv6) || (queryType === RRType.AAAA && isIPv6);
    });
    
    if (filteredIps.length === 0) {
      if (passThrough) {
        return false; // Let other plugins handle it
      } else {
        // Return NODATA response (NOERROR with no answers)
        ctx.setError(RCODE.NOERROR);
        return true;
      }
    }
    
    // In a real implementation, we would construct a proper DNS response
    // with the A/AAAA records. For this example, we'll just log what we'd do
    console.log(`Would respond to ${queryDomain} with ${filteredIps.join(', ')}`);
    
    // Set a mock response for now
    // In a real implementation, this would be generated with proper records
    const responseBuffer = generateMockResponse(ctx.dnsMessage, filteredIps, ttl);
    ctx.setResponse(responseBuffer);
    ctx.addTag('hosts_resolved');
    
    return true;
  } catch (error) {
    console.error('Error in hosts plugin:', error);
    return false;
  }
}

/**
 * Generate a mock DNS response
 * 
 * In a real implementation, this would properly construct a DNS response packet.
 * For this example, we're just modifying the query to look like a response.
 * 
 * @param {Object} dnsMessage - Original DNS message
 * @param {Array<string>} ips - IP addresses for the response
 * @param {number} ttl - TTL for the response
 * @returns {ArrayBuffer} DNS response buffer
 */
function generateMockResponse(dnsMessage, ips, ttl) {
  if (!dnsMessage || !dnsMessage.buffer) {
    throw new Error('Invalid DNS message');
  }
  
  // Clone the original message buffer
  const responseBuffer = new ArrayBuffer(dnsMessage.buffer.byteLength);
  new Uint8Array(responseBuffer).set(new Uint8Array(dnsMessage.buffer));
  
  // Modify it to be a response
  const view = new DataView(responseBuffer);
  
  // Set QR bit to 1 (response)
  let flags = view.getUint16(2);
  flags |= 0x8000;
  view.setUint16(2, flags);
  
  // Set ANCOUNT to the number of IPs
  // In a real implementation, we would add actual answer records
  view.setUint16(6, ips.length);
  
  return responseBuffer;
} 