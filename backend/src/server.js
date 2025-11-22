// server.js
import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import { serve } from "inngest/express";
import { clerkMiddleware } from "@clerk/express";
import { fileURLToPath } from "url";

import { ENV } from "./lib/env.js";
import { connectDB } from "./lib/db.js";
import { inngest, functions } from "./lib/inngest.js";

import chatRoutes from "./routes/chatRoutes.js";
import sessionRoutes from "./routes/sessionRoute.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// middleware
app.use(express.json());
// credentials:true means browser may include cookies with cross-origin requests
app.use(cors({ origin: ENV.CLIENT_URL, credentials: true }));

// Clerk middleware (keep if you're using Clerk server-side)
app.use(clerkMiddleware());

app.use("/api/inngest", serve({ client: inngest, functions }));
app.use("/api/chat", chatRoutes);
app.use("/api/sessions", sessionRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ msg: "api is up and running" });
});

/**
 * Production static serving
 * - Use process.cwd() so Vercel / serverless can find files from the project root.
 * - guard with fs.existsSync to avoid ENOENT when frontend isn't bundled into the function.
 */
if (ENV.NODE_ENV === "production") {
  const distPath = path.join(process.cwd(), "frontend", "dist");

  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));

    // Use a wildcard route so client-side routing works.
    app.get("*", (req, res) => {
      const indexFile = path.join(distPath, "index.html");
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        // fallback JSON if index.html missing (prevents ENOENT crash)
        res.status(404).json({ error: "index.html not found" });
      }
    });
  } else {
    // If dist isn't present (e.g. you deployed API only), don't crash — log a helpful message.
    console.warn(
      `Production dist folder not found at ${distPath}. Static files will not be served.`
    );
  }
}

/**
 * Connect DB and start server only when running locally (not on Vercel serverless)
 * Vercel sets the VERCEL env var to "1" during builds/runs; avoid listening in that environment.
 */
const startServer = async () => {
  try {
    await connectDB();
    // Only listen when NOT running on Vercel serverless environment
    if (!process.env.VERCEL) {
      const port = ENV.PORT || 3000;
      app.listen(port, () => console.log("Server is running on port:", port));
    } else {
      console.log("Running in Vercel environment — skipping app.listen()");
    }
  } catch (error) {
    console.error("💥 Error starting the server", error);
  }
};

startServer();

// Export the app for serverless platforms (Vercel)
export default app;
