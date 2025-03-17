/**
 * Redirect Plugin
 * 
 * Allows redirecting DNS queries for certain domains to different domains.
 * Useful for custom DNS redirection and creating DNS aliases.
 */

import { registerPlugin } from '../core/plugin-chain';
import { normalizeDomain, domainMatch } from '../utils/dns-util';

/**
 * Register the redirect plugin
 */
export function register() {
  registerPlugin('redirect', executeRedirect);
}

/**
 * Execute the redirect plugin
 * 
 * @param {DnsContext} ctx - DNS request context
 * @param {Object} args - Plugin arguments
 * @returns {Promise<boolean>} True if the request was redirected
 */
export async function executeRedirect(ctx, args) {
  const {
    rules = [],             // Redirect rules
    preserveType = true,    // Whether to preserve the query type
    includeSubdomains = true // Whether redirects apply to subdomains
  } = args;
  
  try {
    // Get query domain
    const queryDomain = ctx.getQueryDomain();
    
    if (!queryDomain || !Array.isArray(rules) || rules.length === 0) {
      return false;
    }
    
    // Find matching rule
    const normalizedDomain = normalizeDomain(queryDomain);
    
    for (const rule of rules) {
      const { from, to, type } = rule;
      
      if (!from || !to) {
        continue;
      }
      
      // Check domain match
      const isMatch = domainMatch(normalizedDomain, from, includeSubdomains);
      
      // Check query type match if specified
      const queryType = ctx.getQueryType();
      const typeMatches = !type || type === queryType;
      
      if (isMatch && typeMatches) {
        // Apply the redirect
        return applyRedirect(ctx, from, to, includeSubdomains);
      }
    }
    
    return false; // No matching rule
  } catch (error) {
    console.error('Error in redirect plugin:', error);
    return false;
  }
}

/**
 * Apply a redirect rule
 * 
 * @param {DnsContext} ctx - DNS request context
 * @param {string} from - Source domain pattern
 * @param {string} to - Target domain
 * @param {boolean} includeSubdomains - Whether to redirect subdomains
 * @returns {boolean} True if redirect was applied
 */
function applyRedirect(ctx, from, to, includeSubdomains) {
  const originalDomain = ctx.getQueryDomain();
  let redirectDomain = to;
  
  // For subdomain redirects, preserve the subdomain part
  if (includeSubdomains && from !== originalDomain) {
    const normalizedFrom = normalizeDomain(from);
    const normalizedOriginal = normalizeDomain(originalDomain);
    
    // If original is subdomain of 'from', extract the subdomain part
    if (normalizedOriginal.endsWith('.' + normalizedFrom)) {
      const subdomain = normalizedOriginal.slice(0, -normalizedFrom.length - 1);
      redirectDomain = subdomain + '.' + to;
    }
  }
  
  // In a real implementation, we would modify the DNS query
  // For this example, we'll just log what we'd do
  console.log(`Would redirect ${originalDomain} to ${redirectDomain}`);
  
  // Instead of modifying the DNS message (which requires more complex parsing),
  // We're just going to flag the request for special handling by the forward plugin
  ctx.metadata.redirect = {
    originalDomain,
    redirectDomain
  };
  
  ctx.addTag('redirected');
  
  return true;
} 