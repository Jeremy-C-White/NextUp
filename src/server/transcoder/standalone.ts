import express from "express";
import { execSync } from "child_process";
import { createTranscoderRouter } from "./routes.js";
import { TranscodeSessionManager } from "./sessionManager.js";
import { getAllowedDomains } from "./security.js";

const PORT = Number(process.env.TRANSCODER_PORT) || 3005;

async function runStandaloneServer() {
  const app = express();
  app.use(express.json());

  // Check FFmpeg and FFprobe availability
  try {
    const ffmpegVer = execSync("ffmpeg -version", { encoding: "utf8" }).split("\n")[0];
    const ffprobeVer = execSync("ffprobe -version", { encoding: "utf8" }).split("\n")[0];
    console.log(`[NextUp Transcoder] Found: ${ffmpegVer}`);
    console.log(`[NextUp Transcoder] Found: ${ffprobeVer}`);
  } catch (err) {
    console.error("[NextUp Transcoder] Error: ffmpeg or ffprobe is not installed or accessible!", err);
  }

  console.log(`[NextUp Transcoder] Whitelisted domains: ${getAllowedDomains().join(", ")}`);

  const sessionManager = new TranscodeSessionManager();
  const router = createTranscoderRouter(sessionManager);

  // Mount at both root and /api/transcode for flexible routing
  app.use("/api/transcode", router);
  app.use("/", router);

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[NextUp Transcoder] Dedicated transcode service listening on http://0.0.0.0:${PORT}`);
  });

  // Graceful cleanup on termination
  const handleExit = () => {
    console.log("[NextUp Transcoder] Shutting down, cleaning active sessions...");
    sessionManager.stop();
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGTERM", handleExit);
  process.on("SIGINT", handleExit);
}

// If invoked directly via tsx/node
runStandaloneServer().catch((err) => {
  console.error("[NextUp Transcoder] Fatal startup error:", err);
  process.exit(1);
});
