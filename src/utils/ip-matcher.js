/**
 * IP Matcher Utilities
 * 
 * Functions for matching IP addresses against CIDR ranges and IP lists.
 */

/**
 * Parse an IPv4 address to a numeric value
 * 
 * @param {string} ip - IPv4 address
 * @returns {number} Numeric representation of the IP
 */
function ipv4ToInt(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    throw new Error('Invalid IPv4 address');
  }
  
  return (parseInt(parts[0], 10) << 24) |
         (parseInt(parts[1], 10) << 16) |
         (parseInt(parts[2], 10) << 8) |
         parseInt(parts[3], 10);
}

/**
 * Check if an IPv4 address is within a CIDR range
 * 
 * @param {string} ip - IPv4 address to check
 * @param {string} cidr - CIDR range (e.g., "192.168.0.0/24")
 * @returns {boolean} True if IP is in range
 */
export function ipInCidr(ip, cidr) {
  try {
    const [range, bitsStr] = cidr.split('/');
    const bits = parseInt(bitsStr, 10);
    
    if (bits < 0 || bits > 32) {
      throw new Error('Invalid CIDR bit count');
    }
    
    const ipInt = ipv4ToInt(ip);
    const rangeInt = ipv4ToInt(range);
    const mask = ~((1 << (32 - bits)) - 1);
    
    return (ipInt & mask) === (rangeInt & mask);
  } catch (error) {
    console.error('Error in CIDR match:', error);
    return false;
  }
}

/**
 * Check if an IP address matches any CIDR in a list
 * 
 * @param {string} ip - IP address to check
 * @param {Array<string>} cidrs - List of CIDR ranges
 * @returns {boolean} True if IP matches any CIDR
 */
export function ipMatchCidrList(ip, cidrs) {
  if (!Array.isArray(cidrs) || cidrs.length === 0) {
    return false;
  }
  
  return cidrs.some(cidr => ipInCidr(ip, cidr));
}

/**
 * Parse a simplified IP range (e.g., "192.168.0.1-192.168.0.100")
 * 
 * @param {string} range - IP range in the format "start-end"
 * @returns {Object} Object with start and end IP as integers
 */
function parseIpRange(range) {
  const [start, end] = range.split('-');
  if (!start || !end) {
    throw new Error('Invalid IP range format');
  }
  
  return {
    start: ipv4ToInt(start.trim()),
    end: ipv4ToInt(end.trim())
  };
}

/**
 * Check if an IP is within a simple range
 * 
 * @param {string} ip - IP address to check
 * @param {string} range - IP range in the format "start-end"
 * @returns {boolean} True if IP is in range
 */
export function ipInRange(ip, range) {
  try {
    const ipInt = ipv4ToInt(ip);
    const { start, end } = parseIpRange(range);
    
    return ipInt >= start && ipInt <= end;
  } catch (error) {
    console.error('Error in IP range match:', error);
    return false;
  }
}

/**
 * Check if an IPv4 address is private
 * 
 * @param {string} ip - IPv4 address to check
 * @returns {boolean} True if IP is private
 */
export function isPrivateIp(ip) {
  const privateRanges = [
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    '127.0.0.0/8'
  ];
  
  return ipMatchCidrList(ip, privateRanges);
} 