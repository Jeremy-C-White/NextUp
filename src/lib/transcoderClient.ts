import type {
  MediaProbeResult,
  TranscodeSessionConfig,
} from "../server/transcoder/types.js";

export interface TranscodeSessionResponse {
  sessionId: string;
  token: string;
  streamUrl: string;
  segmentType: 'fmp4' | 'mpegts';
  videoCodec: string;
  isCopied: boolean;
  durationSeconds: number;
  audioStreams: any[];
  subtitleStreams: any[];
}

export class TranscoderClient {
  private baseUrl: string;

  constructor(baseUrl = "/api/transcode") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  public async isHealthy(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/health`);
      if (!resp.ok) return false;
      const body = await resp.json().catch(() => null);
      return body?.status === "ok" && body?.service === "nextup-transcoder";
    } catch {
      return false;
    }
  }

  public async probe(sourceUrl: string): Promise<MediaProbeResult> {
    const resp = await fetch(`${this.baseUrl}/probe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceUrl }),
    });
    if (!resp.ok) {
      const errorText = await resp.text().catch(() => "");
      throw new Error(`Probe failed (${resp.status}): ${errorText}`);
    }
    return resp.json();
  }

  public async startSession(config: TranscodeSessionConfig): Promise<TranscodeSessionResponse> {
    const resp = await fetch(`${this.baseUrl}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!resp.ok) {
      const errorText = await resp.text().catch(() => "");
      throw new Error(`Failed to start transcode session (${resp.status}): ${errorText}`);
    }
    return resp.json();
  }

  public async heartbeat(sessionId: string, token: string): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/session/${sessionId}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  public async seek(sessionId: string, token: string, seekTime: number): Promise<{ ok: boolean; streamUrl: string }> {
    const resp = await fetch(`${this.baseUrl}/session/${sessionId}/seek`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, seekTime }),
    });
    if (!resp.ok) {
      const errorText = await resp.text().catch(() => "");
      throw new Error(`Seek failed (${resp.status}): ${errorText}`);
    }
    return resp.json();
  }

  public async stop(sessionId: string, token: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/session/${sessionId}?token=${encodeURIComponent(token)}`, {
        method: "DELETE",
      });
    } catch {
      // Best-effort cleanup
    }
  }
}
