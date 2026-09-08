import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const SUBTITLE_TIMEOUT_MS = 25000;

/**
 * Extracts a text subtitle stream (SRT, ASS, VTT, etc.) from a remote media source into a standalone WebVTT file.
 */
export async function extractSubtitleToWebVTT(
  sourceUrl: string,
  streamIndex: number,
  outputVttPath: string
): Promise<string> {
  // If already extracted, return existing file
  if (fs.existsSync(outputVttPath)) {
    return outputVttPath;
  }

  const dir = path.dirname(outputVttPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const args = [
      "-v", "quiet",
      "-y",
      "-user_agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      "-i", sourceUrl,
      "-map", `0:${streamIndex}`,
      "-f", "webvtt",
      outputVttPath,
    ];

    const child = spawn("ffmpeg", args);
    let stderr = "";
    let isDone = false;

    const timer = setTimeout(() => {
      if (!isDone) {
        isDone = true;
        child.kill("SIGKILL");
        reject(new Error(`Subtitle extraction timed out after ${SUBTITLE_TIMEOUT_MS}ms`));
      }
    }, SUBTITLE_TIMEOUT_MS);

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (isDone) return;
      isDone = true;
      clearTimeout(timer);

      if (code !== 0 || !fs.existsSync(outputVttPath)) {
        return reject(new Error(`FFmpeg subtitle extraction failed (exit code ${code}): ${stderr}`));
      }

      resolve(outputVttPath);
    });

    child.on("error", (err) => {
      if (isDone) return;
      isDone = true;
      clearTimeout(timer);
      reject(new Error(`Failed to spawn FFmpeg for subtitle extraction: ${err.message}`));
    });
  });
}
