import { spawn } from "child_process";
import { MediaProbeResult, VideoStreamInfo, AudioStreamInfo, SubtitleStreamInfo } from "./types.js";

const DEFAULT_PROBE_TIMEOUT_MS = 10000;

export function analyzeProbeData(data: any, sourceUrl: string): MediaProbeResult {
  const streams = Array.isArray(data?.streams) ? data.streams : [];
  const format = data?.format || {};

  let videoInfo: VideoStreamInfo | null = null;
  const audioStreams: AudioStreamInfo[] = [];
  const subtitleStreams: SubtitleStreamInfo[] = [];

  let audioIdx = 0;
  let subtitleIdx = 0;

  for (let i = 0; i < streams.length; i++) {
    const s = streams[i];
    const codecType = s.codec_type;
    const codecName = (s.codec_name || "").toLowerCase();

    if (codecType === "video" && !videoInfo) {
      const isHevc = codecName === "hevc" || codecName === "h265";
      const isH264 = codecName === "h264" || codecName === "avc" || codecName === "avc1";
      const fps = s.r_frame_rate ? parseFps(s.r_frame_rate) : undefined;

      videoInfo = {
        index: 0,
        streamIndex: s.index ?? i,
        codec: codecName,
        profile: s.profile,
        pixFmt: s.pix_fmt,
        width: s.width,
        height: s.height,
        fps,
        bitRate: s.bit_rate ? parseInt(s.bit_rate, 10) : undefined,
        durationSeconds: s.duration ? parseFloat(s.duration) : undefined,
        isHevc,
        isH264,
      };
    } else if (codecType === "audio") {
      audioStreams.push({
        index: audioIdx++,
        streamIndex: s.index ?? i,
        codec: codecName,
        channels: s.channels || 2,
        channelLayout: s.channel_layout,
        sampleRate: s.sample_rate ? parseInt(s.sample_rate, 10) : undefined,
        language: s.tags?.language || s.tags?.lang,
        title: s.tags?.title,
        isDefault: s.disposition?.default === 1,
      });
    } else if (codecType === "subtitle") {
      const isImage =
        codecName === "hdmv_pgs_subtitle" ||
        codecName === "dvd_subtitle" ||
        codecName === "dvdsub" ||
        codecName === "pgssub";

      subtitleStreams.push({
        index: subtitleIdx++,
        streamIndex: s.index ?? i,
        codec: codecName,
        language: s.tags?.language || s.tags?.lang,
        title: s.tags?.title,
        isForced: s.disposition?.forced === 1,
        isDefault: s.disposition?.default === 1,
        isImageBased: isImage,
      });
    }
  }

  // Determine if video can be copied safely without re-encoding
  let canVideoCopy = false;
  let recommendedSegmentType: 'fmp4' | 'mpegts' = 'mpegts';
  let requiresTranscodeReason: string | undefined;

  if (!videoInfo) {
    requiresTranscodeReason = "No video stream detected";
  } else if (videoInfo.isHevc) {
    // Apple strictly requires fragmented MP4 (fMP4) for HEVC
    canVideoCopy = true;
    recommendedSegmentType = 'fmp4';
  } else if (videoInfo.isH264) {
    // Standard 8-bit H.264 is safe to copy.
    // 10-bit H.264 (High 10) is not supported by iOS hardware decoders and must be converted to 8-bit yuv420p.
    const is10Bit = videoInfo.pixFmt?.includes("10") || videoInfo.profile?.toLowerCase().includes("high 10");
    if (is10Bit) {
      canVideoCopy = false;
      recommendedSegmentType = 'mpegts';
      requiresTranscodeReason = "H.264 10-bit profile requires conversion to standard 8-bit for Safari";
    } else {
      canVideoCopy = true;
      recommendedSegmentType = 'mpegts';
    }
  } else {
    // VP9, AV1, DivX, etc. require conversion to H.264
    canVideoCopy = false;
    recommendedSegmentType = 'mpegts';
    requiresTranscodeReason = `Codec '${videoInfo.codec}' is not natively playable in Safari HLS; requires H.264 transcoding`;
  }

  const durationSeconds = format.duration
    ? parseFloat(format.duration)
    : videoInfo?.durationSeconds || 0;

  return {
    sourceUrl,
    formatName: format.format_name || "unknown",
    durationSeconds,
    bitRate: format.bit_rate ? parseInt(format.bit_rate, 10) : undefined,
    video: videoInfo,
    audioStreams,
    subtitleStreams,
    canVideoCopy,
    recommendedSegmentType,
    requiresTranscodeReason,
  };
}

function parseFps(str: string): number | undefined {
  if (!str) return undefined;
  const parts = str.split("/");
  if (parts.length === 2) {
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    if (den > 0) return Math.round((num / den) * 100) / 100;
  }
  const val = parseFloat(str);
  return isNaN(val) ? undefined : val;
}

/**
 * Runs ffprobe on a given remote URL with a timeout.
 */
export async function probeMedia(sourceUrl: string, timeoutMs = DEFAULT_PROBE_TIMEOUT_MS): Promise<MediaProbeResult> {
  return new Promise((resolve, reject) => {
    const args = [
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      "-show_streams",
      "-analyzeduration", "10000000",
      "-probesize", "10000000",
      "-user_agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      sourceUrl,
    ];

    const child = spawn("ffprobe", args);

    let stdout = "";
    let stderr = "";
    let isDone = false;

    const timer = setTimeout(() => {
      if (!isDone) {
        isDone = true;
        child.kill("SIGKILL");
        reject(new Error(`ffprobe inspection timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (isDone) return;
      isDone = true;
      clearTimeout(timer);

      if (code !== 0) {
        return reject(new Error(`ffprobe failed with exit code ${code}: ${stderr || stdout}`));
      }

      try {
        const json = JSON.parse(stdout);
        const result = analyzeProbeData(json, sourceUrl);
        resolve(result);
      } catch (err: any) {
        reject(new Error(`Failed to parse ffprobe JSON output: ${err.message}`));
      }
    });

    child.on("error", (err) => {
      if (isDone) return;
      isDone = true;
      clearTimeout(timer);
      reject(new Error(`Failed to spawn ffprobe: ${err.message}`));
    });
  });
}
