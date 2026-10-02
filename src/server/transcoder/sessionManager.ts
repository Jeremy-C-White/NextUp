import fs from "fs";
import path from "path";
import os from "os";
import {
  MediaProbeResult,
  TranscodeSessionConfig,
  TranscodeSessionStatus,
} from "./types.js";
import {
  generateSessionToken,
  verifySessionToken,
  ConcurrencyLimiter,
} from "./security.js";
import {
  spawnFFmpegSession,
  FFmpegInstance,
} from "./ffmpegEngine.js";

const DEFAULT_BASE_DIR = path.join(os.tmpdir(), "nextup_transcoder");
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // tolerate iOS lock-screen and background timer suspension
const MAX_SESSION_DISK_BYTES = 2 * 1024 * 1024 * 1024; // emergency ceiling; FFmpeg normally prunes its HLS window

export interface ActiveSession {
  id: string;
  token: string;
  clientIp: string;
  createdAt: number;
  lastHeartbeat: number;
  workDir: string;
  config: TranscodeSessionConfig;
  probe: MediaProbeResult;
  ffmpeg: FFmpegInstance;
  status: 'ready' | 'running' | 'error' | 'stopped';
  error?: string;
  streamUrl: string;
}

export class TranscodeSessionManager {
  private sessions = new Map<string, ActiveSession>();
  private limiter = new ConcurrencyLimiter();
  private watchdogInterval: NodeJS.Timeout | null = null;
  private baseDir: string;

  constructor(baseDir = DEFAULT_BASE_DIR) {
    this.baseDir = baseDir;
    this.initCleanup();
    this.startWatchdog();
  }

  /**
   * Cleans stale transcoder files on server/module startup.
   */
  public initCleanup(): void {
    try {
      if (fs.existsSync(this.baseDir)) {
        fs.rmSync(this.baseDir, { recursive: true, force: true });
      }
      fs.mkdirSync(this.baseDir, { recursive: true });
    } catch (err) {
      console.warn("Transcoder startup cleanup warning:", err);
    }
  }

  /**
   * Starts a new transcode session.
   */
  public async createSession(
    clientIp: string,
    config: TranscodeSessionConfig,
    probe: MediaProbeResult
  ): Promise<ActiveSession> {
    // Check concurrency limit
    const check = this.limiter.canStartSession(clientIp);
    if (!check.allowed) {
      throw new Error(check.reason || "Concurrency limit exceeded");
    }

    const sessionId = `s_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const token = generateSessionToken(sessionId);
    const workDir = path.join(this.baseDir, sessionId);

    this.limiter.trackSessionStart(clientIp);

    let ffmpeg: FFmpegInstance | null = null;
    try {
      ffmpeg = spawnFFmpegSession({
        sourceUrl: config.sourceUrl,
        probe,
        config,
        workDir,
      });

      // Wait until the initial HLS segments and playlist are ready
      await ffmpeg.waitUntilReady(25000);

      const session: ActiveSession = {
        id: sessionId,
        token,
        clientIp,
        createdAt: Date.now(),
        lastHeartbeat: Date.now(),
        workDir,
        config,
        probe,
        ffmpeg,
        status: 'ready',
        streamUrl: `/api/transcode/session/${sessionId}/index.m3u8?token=${token}`,
      };

      this.sessions.set(sessionId, session);
      return session;
    } catch (err: any) {
      this.limiter.trackSessionEnd(clientIp);
      if (ffmpeg) await ffmpeg.stop().catch(() => {});
      try {
        if (fs.existsSync(workDir)) {
          fs.rmSync(workDir, { recursive: true, force: true });
        }
      } catch {}
      throw err;
    }
  }

  /**
   * Validates access and returns the active session.
   */
  public getSession(sessionId: string, token: string): ActiveSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Transcode session not found or has expired");
    }

    const verification = verifySessionToken(sessionId, token);
    if (!verification.valid) {
      throw new Error(verification.reason || "Unauthorized transcode session token");
    }

    // Refresh activity timestamp
    session.lastHeartbeat = Date.now();
    return session;
  }

  /**
   * Handles client heartbeat pings.
   */
  public recordHeartbeat(sessionId: string, token: string): boolean {
    const session = this.getSession(sessionId, token);
    session.lastHeartbeat = Date.now();
    return true;
  }

  /**
   * Handles restart-on-seek.
   * Stops current FFmpeg process and restarts FFmpeg at the requested timestamp offset.
   */
  public async seekSession(
    sessionId: string,
    token: string,
    seekTimeSeconds: number
  ): Promise<ActiveSession> {
    const session = this.getSession(sessionId, token);

    // Stop existing FFmpeg child process
    await session.ffmpeg.stop();

    // Clean existing HLS segments to prevent sequence confusion
    try {
      const files = fs.readdirSync(session.workDir);
      for (const file of files) {
        if (file.endsWith(".ts") || file.endsWith(".m4s") || file === "index.m3u8" || file === "init.mp4") {
          fs.rmSync(path.join(session.workDir, file), { force: true });
        }
      }
    } catch {}

    // Update config start time
    session.config.startTime = seekTimeSeconds;

    // Spawn new FFmpeg process at seek offset
    const newFfmpeg = spawnFFmpegSession({
      sourceUrl: session.config.sourceUrl,
      probe: session.probe,
      config: session.config,
      workDir: session.workDir,
    });

    await newFfmpeg.waitUntilReady(15000);

    session.ffmpeg = newFfmpeg;
    session.lastHeartbeat = Date.now();
    session.status = 'ready';

    return session;
  }

  /**
   * Terminates and cleans up a session immediately.
   */
  public async destroySession(sessionId: string, token?: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (token) {
      const verification = verifySessionToken(sessionId, token);
      if (!verification.valid) {
        throw new Error("Unauthorized session deletion");
      }
    }

    this.sessions.delete(sessionId);
    this.limiter.trackSessionEnd(session.clientIp);

    try {
      await session.ffmpeg.stop();
    } catch (err) {
      console.warn(`Error stopping FFmpeg for session ${sessionId}:`, err);
    }

    try {
      if (fs.existsSync(session.workDir)) {
        fs.rmSync(session.workDir, { recursive: true, force: true });
      }
    } catch (err) {
      console.warn(`Error cleaning workDir for session ${sessionId}:`, err);
    }
  }

  /**
   * Watchdog timer for inactivity timeout and disk quota enforcement.
   */
  private startWatchdog(): void {
    if (this.watchdogInterval) return;

    this.watchdogInterval = setInterval(async () => {
      const now = Date.now();

      for (const [id, session] of this.sessions.entries()) {
        // Inactivity timeout
        if (now - session.lastHeartbeat > INACTIVITY_TIMEOUT_MS) {
          console.log(`[Transcoder Watchdog] Session ${id} expired due to inactivity. Pruning.`);
          await this.destroySession(id).catch(() => {});
          continue;
        }

        // Disk limit enforcement
        try {
          if (fs.existsSync(session.workDir)) {
            const size = this.getDirectorySize(session.workDir);
            if (size > MAX_SESSION_DISK_BYTES) {
              console.warn(`[Transcoder Watchdog] Session ${id} exceeded the emergency disk ceiling. Stopping it.`);
              await this.destroySession(id).catch(() => {});
            }
          }
        } catch {}
      }
    }, 10000);
  }

  private getDirectorySize(dir: string): number {
    let total = 0;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isFile()) {
          total += fs.statSync(path.join(dir, e.name)).size;
        }
      }
    } catch {}
    return total;
  }

  public getSessionCount(): number {
    return this.sessions.size;
  }

  public stop(): void {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
    for (const id of this.sessions.keys()) {
      this.destroySession(id).catch(() => {});
    }
  }
}
