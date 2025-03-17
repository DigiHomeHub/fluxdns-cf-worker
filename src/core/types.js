/**
 * FluxDNS Type Definitions
 * 
 * This file contains TypeScript-like definitions for DNS processing objects.
 */

/**
 * DNS Resource Record Types
 */
export const RRType = {
  A: 1,
  NS: 2,
  CNAME: 5,
  SOA: 6,
  PTR: 12,
  MX: 15,
  TXT: 16,
  AAAA: 28,
  SRV: 33,
  OPT: 41,
  ANY: 255
};

/**
 * DNS Response Codes
 */
export const RCODE = {
  NOERROR: 0,
  FORMERR: 1,
  SERVFAIL: 2,
  NXDOMAIN: 3,
  NOTIMP: 4,
  REFUSED: 5
};

/**
 * Plugin execution statuses
 */
export const PluginStatus = {
  CONTINUE: 'continue',
  RESOLVED: 'resolved',
  ERROR: 'error'
}; 