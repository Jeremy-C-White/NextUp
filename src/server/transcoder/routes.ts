import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs";
import { validateSourceUrl } from "./security.js";
import { probeMedia } from "./prober.js";
import { TranscodeSessionManager } from "./sessionManager.js";
import { extractSubtitleToWebVTT } from "./subtitleExtractor.js";
import { TranscodeSessionConfig } from "./types.js";

export function rewriteHlsPlaylistWithToken(content: string, token: string, revision = ""): string {
  const appendToken = (uri: string) => {
    if (!/^(?:segment_\d+\.(?:ts|m4s)|init\.mp4)$/.test(uri)) return uri;
    const query = new URLSearchParams({ token });
    if (revision) query.set("v", revision);
    return `${uri}?${query.toString()}`;
  };

  return content
    .replace(/URI="([^"]+)"/g, (_match, uri: string) => `URI="${appendToken(uri)}"`)
    .replace(/^(segment_\d+\.(?:ts|m4s)|init\.mp4)$/gm, (_match, uri: string) => appendToken(uri));
}

export function createTranscoderRouter(sessionManager = new TranscodeSessionManager()): Router {
  const router = Router();

  const getClientIp = (req: Request): string => {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      return forwarded.split(",")[0].trim();
    }
    return req.socket.remoteAddress || "127.0.0.1";
  };

  const getParam = (val: string | string[] | undefined): string => {
    if (Array.isArray(val)) return val[0] || "";
    return val || "";
  };

  // Health & diagnostics
  router.get("/health", (req: Request, res: Response) => {
    res.json({
      status: "ok",
      activeSessions: sessionManager.getSessionCount(),
      service: "nextup-transcoder",
    });
  });

  // 1. FFprobe Inspection
  router.post("/probe", async (req: Request, res: Response) => {
    const { sourceUrl } = req.body || {};
    if (!sourceUrl) {
      return res.status(400).json({ error: "Missing sourceUrl in request body" });
    }

    const validation = validateSourceUrl(sourceUrl);
    if (!validation.valid) {
      return res.status(403).json({ error: validation.reason || "Source URL rejected" });
    }

    try {
      const probeResult = await probeMedia(sourceUrl);
      res.json(probeResult);
    } catch (err: any) {
      res.status(502).json({ error: `Probe failed: ${err.message}` });
    }
  });

  // 2. Start Transcode / Remux Session
  router.post("/session", async (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    const { sourceUrl, startTime, audioTrackIndex, burnSubtitleTrackIndex, forceH264 } = req.body || {};

    if (!sourceUrl) {
      return res.status(400).json({ error: "Missing sourceUrl in request body" });
    }

    const validation = validateSourceUrl(sourceUrl);
    if (!validation.valid) {
      return res.status(403).json({ error: validation.reason || "Source URL rejected" });
    }

    try {
      // Step 1: FFprobe inspection
      const probe = await probeMedia(sourceUrl);

      // Step 2: Build config
      const config: TranscodeSessionConfig = {
        sourceUrl,
        startTime: typeof startTime === "number" && startTime > 0 ? startTime : 0,
        audioTrackIndex: typeof audioTrackIndex === "number" ? audioTrackIndex : undefined,
        burnSubtitleTrackIndex: typeof burnSubtitleTrackIndex === "number" ? burnSubtitleTrackIndex : undefined,
        forceH264: Boolean(forceH264),
      };

      // Step 3: Launch session and wait for HLS readiness
      const session = await sessionManager.createSession(clientIp, config, probe);

      res.status(201).json({
        sessionId: session.id,
        token: session.token,
        streamUrl: session.streamUrl,
        segmentType: session.ffmpeg.segmentType,
        videoCodec: probe.video?.codec || "unknown",
        isCopied: probe.canVideoCopy && !config.forceH264 && config.burnSubtitleTrackIndex === undefined,
        durationSeconds: probe.durationSeconds,
        audioStreams: probe.audioStreams,
        subtitleStreams: probe.subtitleStreams,
      });
    } catch (err: any) {
      console.error("[Transcoder API] Error starting session:", err);
      res.status(500).json({ error: err.message || "Failed to start transcode session" });
    }
  });

  // 3. Serve HLS Playlist (index.m3u8)
  router.get("/session/:sessionId/index.m3u8", (req: Request, res: Response) => {
    const sessionId = getParam(req.params.sessionId);
    const token = (req.query.token as string) || (req.headers["x-session-token"] as string);

    try {
      const session = sessionManager.getSession(sessionId, token);
      const playlistPath = path.join(session.workDir, "index.m3u8");

      if (!fs.existsSync(playlistPath)) {
        return res.status(404).json({ error: "HLS playlist not found" });
      }

      // Read playlist and rewrite segment paths to include session token
      let content = fs.readFileSync(playlistPath, "utf8");
      // Append the session token to media segments and the fMP4 init URI.
      content = rewriteHlsPlaylistWithToken(content, token, String(req.query.v || ""));

      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.send(content);
    } catch (err: any) {
      res.status(403).json({ error: err.message || "Unauthorized" });
    }
  });

  // 4. Serve Segment Files (.ts, .m4s, init.mp4)
  router.get("/session/:sessionId/:segmentFile", (req: Request, res: Response) => {
    const sessionId = getParam(req.params.sessionId);
    const segmentFile = getParam(req.params.segmentFile);
    const token = (req.query.token as string) || (req.headers["x-session-token"] as string);

    // Prevent directory traversal
    if (segmentFile.includes("..") || segmentFile.includes("/")) {
      return res.status(400).json({ error: "Invalid segment filename" });
    }

    try {
      const session = sessionManager.getSession(sessionId, token);
      const filePath = path.join(session.workDir, segmentFile);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Segment not found" });
      }

      const ext = path.extname(segmentFile).toLowerCase();
      let contentType = "application/octet-stream";
      if (ext === ".ts") contentType = "video/mp2t";
      else if (ext === ".m4s" || ext === ".mp4") contentType = "video/mp4";

      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Access-Control-Allow-Origin", "*");

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } catch (err: any) {
      res.status(403).json({ error: err.message || "Unauthorized" });
    }
  });

  // 5. WebVTT Subtitle Extraction
  router.get("/session/:sessionId/subtitles/:streamIndex.vtt", async (req: Request, res: Response) => {
    const sessionId = getParam(req.params.sessionId);
    const streamIndex = getParam(req.params.streamIndex);
    const token = (req.query.token as string) || (req.headers["x-session-token"] as string);
    const idxNum = parseInt(streamIndex, 10);

    if (isNaN(idxNum)) {
      return res.status(400).json({ error: "Invalid subtitle stream index" });
    }

    try {
      const session = sessionManager.getSession(sessionId, token);
      const vttPath = path.join(session.workDir, `subtitle_${idxNum}.vtt`);

      await extractSubtitleToWebVTT(session.config.sourceUrl, idxNum, vttPath);

      res.setHeader("Content-Type", "text/vtt; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.setHeader("Access-Control-Allow-Origin", "*");
      const stream = fs.createReadStream(vttPath);
      stream.pipe(res);
    } catch (err: any) {
      res.status(500).json({ error: `Subtitle extraction failed: ${err.message}` });
    }
  });

  // 6. Client Heartbeat
  router.post("/session/:sessionId/heartbeat", (req: Request, res: Response) => {
    const sessionId = getParam(req.params.sessionId);
    const { token } = req.body || {};

    try {
      sessionManager.recordHeartbeat(sessionId, token);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(403).json({ error: err.message || "Heartbeat failed" });
    }
  });

  // 7. Restart-on-Seek
  router.post("/session/:sessionId/seek", async (req: Request, res: Response) => {
    const sessionId = getParam(req.params.sessionId);
    const { token, seekTime } = req.body || {};

    if (typeof seekTime !== "number" || seekTime < 0) {
      return res.status(400).json({ error: "Invalid seekTime parameter" });
    }

    try {
      const updatedSession = await sessionManager.seekSession(sessionId, token, seekTime);
      res.json({
        ok: true,
        sessionId: updatedSession.id,
        currentStartTime: seekTime,
        streamUrl: updatedSession.streamUrl,
      });
    } catch (err: any) {
      res.status(500).json({ error: `Seek failed: ${err.message}` });
    }
  });

  // 8. Delete / Close Session
  router.delete("/session/:sessionId", async (req: Request, res: Response) => {
    const sessionId = getParam(req.params.sessionId);
    const token = (req.query.token as string) || req.body?.token;

    try {
      await sessionManager.destroySession(sessionId, token);
      res.json({ ok: true, message: "Session terminated" });
    } catch (err: any) {
      res.status(403).json({ error: err.message || "Failed to terminate session" });
    }
  });

  return router;
}
