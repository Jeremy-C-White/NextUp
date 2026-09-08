import { describe, it, expect } from "vitest";
import {
  isDomainAllowed,
  isPrivateOrReservedHost,
  validateSourceUrl,
  generateSessionToken,
  verifySessionToken,
  ConcurrencyLimiter,
} from "./security.js";

describe("Transcoder Security Module", () => {
  describe("Domain & SSRF Validation", () => {
    it("allows official debrid streaming provider domains", () => {
      expect(isDomainAllowed("real-debrid.com")).toBe(true);
      expect(isDomainAllowed("download.real-debrid.com")).toBe(true);
      expect(isDomainAllowed("s12.alldebrid.com")).toBe(true);
      expect(isDomainAllowed("torbox.app")).toBe(true);
      expect(isDomainAllowed("premiumize.me")).toBe(true);
    });

    it("rejects unauthorized external domains", () => {
      expect(isDomainAllowed("evil-hacker.com")).toBe(false);
      expect(isDomainAllowed("youtube.com")).toBe(false);
      expect(isDomainAllowed("example.com")).toBe(false);
    });

    it("detects and blocks private/loopback/cloud metadata IP addresses", () => {
      expect(isPrivateOrReservedHost("localhost")).toBe(true);
      expect(isPrivateOrReservedHost("127.0.0.1")).toBe(true);
      expect(isPrivateOrReservedHost("169.254.169.254")).toBe(true); // GCP/AWS metadata
      expect(isPrivateOrReservedHost("10.0.0.1")).toBe(true);
      expect(isPrivateOrReservedHost("192.168.1.1")).toBe(true);
      expect(isPrivateOrReservedHost("172.16.0.5")).toBe(true);
      expect(isPrivateOrReservedHost("real-debrid.com")).toBe(false);
    });

    it("validates safe URLs and blocks non-HTTPS / SSRF targets", () => {
      const valid = validateSourceUrl("https://download.real-debrid.com/d/xyz/video.mkv");
      expect(valid.valid).toBe(true);

      const httpUrl = validateSourceUrl("http://download.real-debrid.com/d/xyz/video.mkv");
      expect(httpUrl.valid).toBe(false);
      expect(httpUrl.reason).toContain("HTTPS");

      const ssrfUrl = validateSourceUrl("https://169.254.169.254/computeMetadata/v1/");
      expect(ssrfUrl.valid).toBe(false);
      expect(ssrfUrl.reason).toContain("private/internal network");

      const disallowedUrl = validateSourceUrl("https://untrusted-host.com/video.mp4");
      expect(disallowedUrl.valid).toBe(false);
      expect(disallowedUrl.reason).toContain("whitelist");
    });
  });

  describe("Session Tokens", () => {
    it("generates and verifies valid session tokens", () => {
      const sessionId = "session-123";
      const clientIp = "192.0.2.1";
      const token = generateSessionToken(sessionId, clientIp);

      const result = verifySessionToken(sessionId, token, clientIp);
      expect(result.valid).toBe(true);
    });

    it("rejects tokens for mismatched session ID or client IP", () => {
      const sessionId = "session-123";
      const clientIp = "192.0.2.1";
      const token = generateSessionToken(sessionId, clientIp);

      const wrongSession = verifySessionToken("session-999", token, clientIp);
      expect(wrongSession.valid).toBe(false);

      const wrongIp = verifySessionToken(sessionId, token, "192.0.2.99");
      expect(wrongIp.valid).toBe(false);
    });

    it("rejects malformed or tampered tokens", () => {
      expect(verifySessionToken("s1", "invalid-token", "1.1.1.1").valid).toBe(false);
      expect(verifySessionToken("s1", "12345.badhex", "1.1.1.1").valid).toBe(false);
    });
  });

  describe("Concurrency Limiter", () => {
    it("enforces per-IP and server-wide concurrency caps", () => {
      const limiter = new ConcurrencyLimiter();
      const ip = "192.0.2.10";

      // Session 1 allowed
      expect(limiter.canStartSession(ip).allowed).toBe(true);
      limiter.trackSessionStart(ip);

      // Session 2 allowed
      expect(limiter.canStartSession(ip).allowed).toBe(true);
      limiter.trackSessionStart(ip);

      // Session 3 from same IP should be blocked (limit is 2)
      const check3 = limiter.canStartSession(ip);
      expect(check3.allowed).toBe(false);
      expect(check3.reason).toContain("limit: 2");

      // Ending a session frees up capacity
      limiter.trackSessionEnd(ip);
      expect(limiter.canStartSession(ip).allowed).toBe(true);
    });
  });
});
