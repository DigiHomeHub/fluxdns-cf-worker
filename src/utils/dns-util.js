/**
 * DNS Utility Functions
 * 
 * Helper functions for DNS operations and domain matching.
 */

/**
 * Convert domain to normalized form
 * 
 * @param {string} domain - Domain name to normalize
 * @returns {string} Normalized domain
 */
export function normalizeDomain(domain) {
  // Remove trailing dot if present
  if (domain.endsWith('.')) {
    domain = domain.slice(0, -1);
  }
  
  // Convert to lowercase
  return domain.toLowerCase();
}

/**
 * Check if a domain matches another domain or is a subdomain
 * 
 * @param {string} domain - Domain to check
 * @param {string} pattern - Domain pattern to match against
 * @param {boolean} includeSubdomains - Whether to include subdomains in match
 * @returns {boolean} True if domain matches pattern
 */
export function domainMatch(domain, pattern, includeSubdomains = true) {
  domain = normalizeDomain(domain);
  pattern = normalizeDomain(pattern);
  
  if (domain === pattern) {
    return true;
  }
  
  if (includeSubdomains && domain.endsWith('.' + pattern)) {
    return true;
  }
  
  return false;
}

/**
 * Check if a domain matches any pattern in a list
 * 
 * @param {string} domain - Domain to check
 * @param {Array<string>} patterns - List of domain patterns
 * @param {boolean} includeSubdomains - Whether to include subdomains in match
 * @returns {boolean} True if domain matches any pattern
 */
export function domainMatchList(domain, patterns, includeSubdomains = true) {
  if (!Array.isArray(patterns) || patterns.length === 0) {
    return false;
  }
  
  return patterns.some(pattern => domainMatch(domain, pattern, includeSubdomains));
}

/**
 * Check if a domain matches a pattern with wildcard support
 * 
 * @param {string} domain - Domain to check
 * @param {string} pattern - Pattern with optional wildcards
 * @returns {boolean} True if domain matches pattern
 */
export function wildcardMatch(domain, pattern) {
  domain = normalizeDomain(domain);
  pattern = normalizeDomain(pattern);
  
  // Convert wildcard pattern to regex
  if (pattern.includes('*')) {
    const regexPattern = pattern
      .replace(/\./g, '\\.')  // Escape dots
      .replace(/\*/g, '.*');  // Convert * to regex wildcard
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(domain);
  }
  
  // If no wildcards, use standard matching
  return domainMatch(domain, pattern);
}

/**
 * Get parent domain at a specific level
 * 
 * @param {string} domain - Domain to get parent for
 * @param {number} level - Level of parent (1 = top level)
 * @returns {string|null} Parent domain or null if not available
 */
export function getParentDomain(domain, level = 1) {
  domain = normalizeDomain(domain);
  const parts = domain.split('.');
  
  if (parts.length <= level) {
    return null;
  }
  
  return parts.slice(-(level + 1)).join('.');
}

/**
 * Check if a domain is an IP address
 * 
 * @param {string} domain - Domain to check
 * @returns {boolean} True if domain is an IP address
 */
export function isIpAddress(domain) {
  // Simple regex to match IPv4 and IPv6 addresses
  const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)/;
  
  return ipv4Regex.test(domain) || ipv6Regex.test(domain);
} 