import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createTranscoderRouter } from "./src/server/transcoder/routes.js";
import { TranscodeSessionManager } from "./src/server/transcoder/sessionManager.js";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Keep MKV playback inside NextUp. The browser asks this same-origin API to
  // remux or transcode an otherwise incompatible source into native iPhone HLS.
  const transcodeSessions = new TranscodeSessionManager();
  app.use("/api/transcode", createTranscoderRouter(transcodeSessions));

  app.get("/api/debrid/stream", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    let parsedTarget: URL;
    try {
      parsedTarget = new URL(targetUrl);
    } catch {
      return res.status(400).json({ error: "Invalid stream-provider URL" });
    }
    if (parsedTarget.protocol !== "https:" && parsedTarget.hostname !== "localhost" && parsedTarget.hostname !== "127.0.0.1") {
      return res.status(400).json({ error: "Stream-provider URL must use HTTPS" });
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 135000);

      // `request.close` also fires after a normal request body completes on
      // modern Node versions, which used to cancel nearly every provider call.
      req.on('aborted', () => {
        controller.abort();
      });
      res.on('close', () => {
        if (!res.writableEnded) controller.abort();
      });

      let resp;
      try {
        resp = await fetch(parsedTarget, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9"
          },
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        return res.status(resp.status).send(text || resp.statusText);
      }
      const data = await resp.json();
      res.json(data);
    } catch (err: any) {
      console.error("Proxy error fetching debrid stream:", err);
      if (err.name === "AbortError") {
        res.status(504).json({ error: "Stream resolution timed out upstream" });
      } else {
        res.status(502).json({ error: err.message || "Failed to reach stream provider from server proxy" });
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // For Express 5
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    transcodeSessions.stop();
    server.close(() => process.exit(0));
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

startServer();
