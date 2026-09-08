import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { MediaProbeResult, TranscodeSessionConfig } from "./types.js";

export interface FFmpegInstance {
  process: ChildProcess;
  workDir: string;
  playlistPath: string;
  segmentType: 'fmp4' | 'mpegts';
  startTime: number;
  stop: () => Promise<void>;
  waitUntilReady: (timeoutMs?: number) => Promise<void>;
}

export function buildFFmpegArgs(options: {
  sourceUrl: string;
  probe: MediaProbeResult;
  config: TranscodeSessionConfig;
  workDir: string;
  segmentType: 'fmp4' | 'mpegts';
}): string[] {
  const { sourceUrl, probe, config, workDir, segmentType } = options;
  const startTime = config.startTime || 0;
  const args: string[] = [];

  // Hide banner, log error level for performance
  args.push("-hide_banner", "-loglevel", "warning");

  // HTTP User Agent for stream providers
  args.push("-user_agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15");

  // Fast input seek (placed before -i for instantaneous demuxer seeking)
  if (startTime > 0) {
    args.push("-ss", startTime.toFixed(2));
  }

  // Input source
  args.push("-i", sourceUrl);

  // Map video stream
  const videoStream = probe.video;
  const videoIndex = videoStream ? videoStream.streamIndex : 0;
  args.push("-map", `0:${videoIndex}`);

  // Video codec determination
  const willBurnSubtitle = config.burnSubtitleTrackIndex !== undefined;
  const canCopy = probe.canVideoCopy && !config.forceH264 && !willBurnSubtitle;

  if (canCopy) {
    args.push("-c:v", "copy");
  } else {
    // Transcode to standard H.264 8-bit baseline/high profile for universal Safari compatibility
    args.push(
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "22",
      "-pix_fmt", "yuv420p",
      "-profile:v", "high",
      "-level", "4.1"
    );

    if (willBurnSubtitle) {
      // PGS / bitmap subtitle overlay filter
      args.push("-filter_complex", `[0:v][0:${config.burnSubtitleTrackIndex}]overlay[v]`);
    }
  }

  // Audio track selection & AAC conversion
  const selectedAudio = probe.audioStreams.find(a => a.index === config.audioTrackIndex)
    || probe.audioStreams[0];
  const audioStreamIndex = selectedAudio ? selectedAudio.streamIndex : 1;

  args.push(
    "-map", `0:${audioStreamIndex}`,
    "-c:a", "aac",
    "-b:a", "192k",
    "-ac", "2",
    "-ar", "48000"
  );

  // HLS Packaging
  const segmentDuration = 4; // 4 seconds per segment
  args.push(
    "-f", "hls",
    "-hls_time", segmentDuration.toString(),
    "-hls_list_size", "8", // Sliding window keeps last 8 segments in playlist
    "-hls_flags", "delete_segments+temp_file" // Automatically prune older segments from disk
  );

  if (segmentType === "fmp4") {
    // Apple strictly requires fragmented MP4 (fMP4) for HEVC
    args.push(
      "-hls_segment_type", "fmp4",
      "-hls_fmp4_init_filename", "init.mp4",
      "-hls_segment_filename", path.join(workDir, "segment_%04d.m4s")
    );
  } else {
    // Standard MPEG-TS segments
    args.push(
      "-hls_segment_filename", path.join(workDir, "segment_%04d.ts")
    );
  }

  // Master output playlist
  args.push(path.join(workDir, "index.m3u8"));

  return args;
}

/**
 * Spawns an FFmpeg transcode/remux process and monitors readiness.
 */
export function spawnFFmpegSession(options: {
  sourceUrl: string;
  probe: MediaProbeResult;
  config: TranscodeSessionConfig;
  workDir: string;
}): FFmpegInstance {
  const { sourceUrl, probe, config, workDir } = options;

  if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir, { recursive: true });
  }

  // Determine segment type: fMP4 for HEVC (Apple requirement) or config override
  const isHevc = probe.video?.isHevc ?? false;
  const segmentType: 'fmp4' | 'mpegts' = isHevc ? 'fmp4' : 'mpegts';

  const args = buildFFmpegArgs({
    sourceUrl,
    probe,
    config,
    workDir,
    segmentType,
  });

  const playlistPath = path.join(workDir, "index.m3u8");
  const initMp4Path = path.join(workDir, "init.mp4");

  const child = spawn("ffmpeg", args, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stderr?.on("data", (chunk) => {
    // Uncomment for local debugging if needed
    // process.stderr.write(`[ffmpeg-${child.pid}] ${chunk.toString()}`);
  });

  const stop = async (): Promise<void> => {
    if (!child.killed && child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise(resolve => setTimeout(resolve, 500));
      if (!child.killed && child.exitCode === null) {
        child.kill("SIGKILL");
      }
    }
  };

  const waitUntilReady = (timeoutMs = 15000): Promise<void> => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkInterval = setInterval(() => {
        // Check if process crashed
        if (child.exitCode !== null) {
          clearInterval(checkInterval);
          return reject(new Error(`FFmpeg exited prematurely with code ${child.exitCode}`));
        }

        // Check timeout
        if (Date.now() - startTime > timeoutMs) {
          clearInterval(checkInterval);
          return reject(new Error(`FFmpeg readiness timed out after ${timeoutMs}ms`));
        }

        // Check if playlist exists and has contents
        if (fs.existsSync(playlistPath)) {
          try {
            const content = fs.readFileSync(playlistPath, "utf8");
            // For fMP4, require init.mp4 and at least one segment entry in playlist
            if (segmentType === "fmp4") {
              if (fs.existsSync(initMp4Path) && content.includes(".m4s")) {
                clearInterval(checkInterval);
                return resolve();
              }
            } else {
              // For MPEG-TS, require at least one .ts entry
              if (content.includes(".ts")) {
                clearInterval(checkInterval);
                return resolve();
              }
            }
          } catch {
            // File might be mid-write, retry next tick
          }
        }
      }, 250);
    });
  };

  return {
    process: child,
    workDir,
    playlistPath,
    segmentType,
    startTime: config.startTime || 0,
    stop,
    waitUntilReady,
  };
}
