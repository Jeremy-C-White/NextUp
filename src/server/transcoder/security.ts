import crypto from "crypto";

const DEFAULT_SECRET = process.env.TRANSCODER_SECRET || "nextup-transcode-security-key-2026";
const MAX_CONCURRENT_PER_IP = 2;
const MAX_CONCURRENT_SERVER = 4;
const TOKEN_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

// Whitelisted provider domains for media streaming
const BASE_ALLOWED_DOMAINS = [
  "real-debrid.com",
  "download.real-debrid.com",
  "alldebrid.com",
  "premiumize.me",
  "torbox.app",
  "debrid-link.fr",
  "archive.org",
];

export function getAllowedDomains(): string[] {
  const custom = process.env.ALLOWED_STREAM_DOMAINS
    ? process.env.ALLOWED_STREAM_DOMAINS.split(",").map(d => d.trim().toLowerCase()).filter(Boolean)
    : [];
  return [...BASE_ALLOWED_DOMAINS, ...custom];
}

/**
 * Checks if a hostname matches an allowed domain or subdomain.
 */
export function isDomainAllowed(hostname: string): boolean {
  const cleanHost = hostname.toLowerCase();
  const allowed = getAllowedDomains();
  return allowed.some(domain => cleanHost === domain || cleanHost.endsWith(`.${domain}`));
}

/**
 * Checks if an IP or hostname is private/internal (SSRF protection).
 */
export function isPrivateOrReservedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return true;
  }
  // Cloud metadata endpoint
  if (host === "169.254.169.254" || host.startsWith("169.254.")) {
    return true;
  }
  // Standard private IPv4 ranges: 10.x.x.x, 192.168.x.x, 172.16-31.x.x
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  const match172 = host.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (match172) {
    const secondOctet = parseInt(match172[1], 10);
    if (secondOctet >= 16 && secondOctet <= 31) return true;
  }
  return false;
}

/**
 * Validates a source URL for safe transcoding.
 */
export function validateSourceUrl(urlStr: string, allowLocalhostForTesting = false): { valid: boolean; reason?: string; url?: URL } {
  if (!urlStr || typeof urlStr !== "string") {
    return { valid: false, reason: "Missing or invalid URL" };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { valid: false, reason: "Malformed URL" };
  }

  // Allow localhost only if explicitly enabled (e.g. unit tests or local development)
  if (allowLocalhostForTesting && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) {
    return { valid: true, url: parsed };
  }

  if (parsed.protocol !== "https:") {
    return { valid: false, reason: "Source URL must use HTTPS" };
  }

  if (isPrivateOrReservedHost(parsed.hostname)) {
    return { valid: false, reason: "Access to private/internal network addresses is prohibited" };
  }

  if (!isDomainAllowed(parsed.hostname)) {
    return {
      valid: false,
      reason: `Domain '${parsed.hostname}' is not in the approved media streaming whitelist`,
    };
  }

  return { valid: true, url: parsed };
}

/**
 * Generates an HMAC signature for a session.
 */
export function generateSessionToken(sessionId: string, clientIp: string, secret = DEFAULT_SECRET): string {
  const timestamp = Date.now();
  const payload = `${sessionId}:${clientIp}:${timestamp}`;
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${timestamp}.${hmac}`;
}

/**
 * Verifies that a session token matches the sessionId and clientIp, and is not expired.
 */
export function verifySessionToken(
  sessionId: string,
  token: string,
  clientIp: string,
  secret = DEFAULT_SECRET
): { valid: boolean; reason?: string } {
  if (!token || typeof token !== "string") {
    return { valid: false, reason: "Missing token" };
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false, reason: "Invalid token format" };
  }

  const [timeStr, signature] = parts;
  const timestamp = parseInt(timeStr, 10);
  if (isNaN(timestamp)) {
    return { valid: false, reason: "Invalid token timestamp" };
  }

  const age = Date.now() - timestamp;
  if (age < 0 || age > TOKEN_MAX_AGE_MS) {
    return { valid: false, reason: "Token expired" };
  }

  const expectedPayload = `${sessionId}:${clientIp}:${timestamp}`;
  const expectedSignature = crypto.createHmac("sha256", secret).update(expectedPayload).digest("hex");

  // Constant-time comparison
  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, reason: "Invalid token signature" };
  }

  return { valid: true };
}

/**
 * Concurrency limiter tracker.
 */
export class ConcurrencyLimiter {
  private ipSessionCount = new Map<string, number>();
  private totalCount = 0;

  canStartSession(ip: string): { allowed: boolean; reason?: string } {
    if (this.totalCount >= MAX_CONCURRENT_SERVER) {
      return { allowed: false, reason: "Server transcode capacity reached. Please try again shortly." };
    }
    const currentForIp = this.ipSessionCount.get(ip) || 0;
    if (currentForIp >= MAX_CONCURRENT_PER_IP) {
      return { allowed: false, reason: "Maximum concurrent sessions per device reached (limit: 2)." };
    }
    return { allowed: true };
  }

  trackSessionStart(ip: string): void {
    this.totalCount++;
    this.ipSessionCount.set(ip, (this.ipSessionCount.get(ip) || 0) + 1);
  }

  trackSessionEnd(ip: string): void {
    this.totalCount = Math.max(0, this.totalCount - 1);
    const count = this.ipSessionCount.get(ip) || 0;
    if (count <= 1) {
      this.ipSessionCount.delete(ip);
    } else {
      this.ipSessionCount.set(ip, count - 1);
    }
  }

  getStats(): { total: number; activeIps: number } {
    return { total: this.totalCount, activeIps: this.ipSessionCount.size };
  }
}
