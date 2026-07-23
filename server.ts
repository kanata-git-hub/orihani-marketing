import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { GoogleGenAI } from "@google/genai";

dotenv.config({ override: true });

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  // Exponential Backoff API proxy example
  app.post("/api/generate", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is missing.");
      }

      const ai = new GoogleGenAI({ apiKey });

      let retries = 3;
      let delay = 1000;
      
      while (retries > 0) {
        try {
          const response = await ai.models.generateContent(req.body);
          // Return both text and the raw response, or whatever the client needs
          return res.json({ text: response.text, ...response });
        } catch (error: any) {
          if (error.status === 429 && retries > 1) {
            retries--;
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2;
          } else {
            throw error;
          }
        }
      }
    } catch (error: any) {
      console.error("Error calling Gemini API:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer } = await import("vite");
      const vite = await createServer({
        server: { middlewareMode: true, hmr: false },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (error) {
      console.error("Vite server failed to start:", error);
    }
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.use((req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
