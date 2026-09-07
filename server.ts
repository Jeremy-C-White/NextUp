import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });


  app.get("/api/introdb", async (req, res) => {
    const { imdb_id, season, episode } = req.query;
    try {
      const response = await fetch(`https://api.introdb.app/segments?imdb_id=${imdb_id}&season=${season}&episode=${episode}`);
      if (!response.ok) {
        return res.status(response.status).send(await response.text());
      }
      const data = await response.json();
      res.json(data);
    } catch (e) {
      console.error("IntroDB proxy error:", e);
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/debrid/stream", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).json({ error: "Missing url parameter" });
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 135000);
      
      req.on('aborted', () => {
        console.log("Client aborted connection");
        controller.abort();
      });

      let resp;
      try {
        resp = await fetch(targetUrl, {
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
      console.error("Error name:", err.name, "Error message:", err.message);
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
