import express, { type Request, Response, NextFunction } from "express";
import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { fileURLToPath } from 'url'

// Manually define __dirname in ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const pathReq = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (pathReq.startsWith("/api")) {
      let logLine = `${req.method} ${pathReq} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = 5005;
  const isDevelopment = app.get("env") === "development";

  if (isDevelopment) {
    // Use HTTP in development mode
    server.listen({
      port,
      host: "0.0.0.0",
    }, () => {
      log(`HTTP Server listening on port ${port} (development mode)`);
    });
  } else {
    // Use HTTPS in production mode
    try {
      // Load self-signed certificates
      const keyPath = path.resolve(__dirname, "../certs/selfsigned.key");
      const certPath = path.resolve(__dirname, "../certs/selfsigned.crt");

      // Check if certificates exist
      if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
        log("Warning: SSL certificates not found. Using HTTP instead of HTTPS.");
        server.listen({
          port,
          host: "0.0.0.0",
        }, () => {
          log(`HTTP Server listening on port ${port} (production mode - no SSL)`);
        });
        return;
      }

      const httpsOptions = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      };

      // Create HTTPS server
      const httpsServer = https.createServer(httpsOptions, app);
      httpsServer.listen({
        port,
        host: "0.0.0.0",
      }, () => {
        log(`HTTPS Server listening on port ${port} (production mode)`);
      });
    } catch (error) {
      log(`Error setting up HTTPS: ${error}. Falling back to HTTP.`);
      server.listen({
        port,
        host: "0.0.0.0",
      }, () => {
        log(`HTTP Server listening on port ${port} (fallback mode)`);
      });
    }
  }
})();
