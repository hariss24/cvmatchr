import dns from "dns/promises";
import ipaddr from "ipaddr.js";

const BLOCKED_RANGES = [
  "0.0.0.0/8",       // "This" network
  "10.0.0.0/8",      // Private
  "100.64.0.0/10",   // CGN
  "127.0.0.0/8",     // Loopback
  "169.254.0.0/16",  // Link-local
  "172.16.0.0/12",   // Private
  "192.0.0.0/24",    // IETF protocol
  "192.168.0.0/16",  // Private
  "198.18.0.0/15",   // Benchmarking
  "224.0.0.0/4",     // Multicast
  "::1/128",         // IPv6 loopback
  "fc00::/7",        // Unique local address
  "fe80::/10",       // Link-local
  "::ffff:0:0/96",   // IPv4-mapped
];

/**
 * Parses and returns the blocked CIDRs.
 */
const getBlockedCIDRs = () => BLOCKED_RANGES.map(range => ipaddr.parseCIDR(range));

/**
 * Checks if an IP address is blocked.
 */
function isBlockedIp(ipStr: string): boolean {
  try {
    let addr = ipaddr.parse(ipStr);
    
    // Normalize IPv4-mapped IPv6 addresses (e.g., ::ffff:127.0.0.1 -> 127.0.0.1)
    if (addr.kind() === "ipv6" && (addr as ipaddr.IPv6).isIPv4MappedAddress()) {
      addr = (addr as ipaddr.IPv6).toIPv4Address();
    }
    
    const cidrs = getBlockedCIDRs();
    
    // check simple ranges (private, loopback, linkLocal, multicast)
    const range = addr.range();
    if (["private", "loopback", "linkLocal", "multicast", "unspecified"].includes(range)) {
      return true;
    }
    
    for (const cidr of cidrs) {
      if (addr.kind() === cidr[0].kind() && addr.match(cidr)) {
        return true;
      }
    }
    return false;
  } catch {
    // If we can't parse the IP, block it just to be safe.
    return true;
  }
}

/**
 * Validates a URL against SSRF attacks.
 * Resolves the DNS of the hostname and checks if it points to a local or private network.
 * @returns { url: string } if valid, throws an Error if invalid.
 */
export async function validateUrlForScraping(urlStr: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error("URL invalide.");
  }
  
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("URL invalide : seuls http et https sont autorisés.");
  }
  
  if (!parsed.hostname) {
    throw new Error("URL invalide : hôte manquant.");
  }

  // Clear credentials (user:pass@host -> host)
  parsed.username = "";
  parsed.password = "";

  try {
    const addresses = await dns.lookup(parsed.hostname, { all: true });
    for (const address of addresses) {
      if (isBlockedIp(address.address)) {
        throw new Error("URL non autorisée.");
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message === "URL non autorisée.") {
      throw e;
    }
    throw new Error("Impossible de résoudre l'hôte.");
  }

  return parsed.toString();
}
