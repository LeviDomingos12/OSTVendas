import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { requireAdmin } from "./src/server/authMiddleware";
import { commercialRouter } from "./src/server/safeEndpoints";
import { aiRouter } from "./src/server/aiRouter";
import { communicationRouter } from "./src/server/communicationRouter";
import { securityRouter } from "./src/server/securityRouter";
import { backupRouter } from "./src/server/backupRouter";
import { dbRouter } from "./src/server/dbRouter";
import { corsMiddleware, securityHeadersMiddleware, ipFirewallMiddleware } from "./src/server/corsMiddleware";
import { 
  generalLimiter, 
  financialLimiter, 
  aiLimiter, 
  emailLimiter, 
  dbLimiter,
  AuthenticatedRequest 
} from "./src/server/rateLimiters";

dotenv.config();

export type { AuthenticatedRequest } from "./src/server/rateLimiters";

export const app = express();
app.set("trust proxy", 1);

// Strict Payload Limits (Prevents DoS and Payload Buffer Overflows)
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ limit: "5mb", extended: true }));

// Middlewares: CORS, Security Headers, IP Firewall
app.use(corsMiddleware);
app.use(securityHeadersMiddleware);
app.use(ipFirewallMiddleware);

// Health check and System Version endpoints
app.get("/api/health", (_req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.json({
    status: "ok",
    version: "34.0",
    buildDate: "2026-09-08",
    formattedVersion: "v34.0",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/system/version", (_req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.json({
    status: "ok",
    version: "34.0",
    formattedVersion: "v34.0",
    buildDate: "2026-09-08",
    channel: "stable-production",
    timestamp: new Date().toISOString()
  });
});

// Mount Financial & Commercial Safe Multi-Tenant API Router
app.use("/api/v1/sales", financialLimiter);
app.use("/api/v1/stock", financialLimiter);
app.use("/api/v1/debts", financialLimiter);
app.use("/api/v1", commercialRouter);

// Mount Modular AI, Communications, Security, Backup & Database Routers
app.use("/api/gemini", aiLimiter, aiRouter);
app.use("/api/email", emailLimiter);
app.use("/api/sms", emailLimiter);
app.use("/api/whatsapp", emailLimiter);
app.use("/api/campaign", emailLimiter);
app.use("/api/send-email", emailLimiter);
app.use("/api", communicationRouter);
app.use("/api/security", securityRouter);
app.use("/api/backups", backupRouter);
app.use("/api/db", dbLimiter, dbRouter);
app.use("/api/admin", requireAdmin, dbRouter);
app.use("/api/system", requireAdmin, dbRouter);

// Fallback general limiter for any other API endpoints
app.use("/api", generalLimiter);

async function startServer() {
  const PORT = 3000;

  // Serve static files / Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // Fallback for client-side routing in development
    app.use("*", async (req, res, next) => {
      if (req.originalUrl.startsWith("/api")) {
        return next();
      }
      try {
        const indexPath = path.resolve(process.cwd(), "index.html");
        if (fs.existsSync(indexPath)) {
          let template = fs.readFileSync(indexPath, "utf-8");
          template = await vite.transformIndexHtml(req.originalUrl, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
          return;
        }
      } catch (err) {
        return next(err);
      }
      next();
    });
  } else {
    const distPath = fs.existsSync(path.join(process.cwd(), "dist", "index.html"))
      ? path.join(process.cwd(), "dist")
      : path.resolve(__dirname);

    // Static assets with cache headers
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        }
      }
    }));

    // Express 4 wildcard catch-all for single-page application routes
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        return next();
      }
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path.join(distPath, "index.html"));
    });

    // Final fallback middleware for any unmatched GET request
    app.use((req, res, next) => {
      if (req.method === "GET" && !req.path.startsWith("/api")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        return res.sendFile(path.join(distPath, "index.html"));
      }
      next();
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

export default app;
