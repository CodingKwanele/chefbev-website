import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import expressLayouts from "express-ejs-layouts";
import helmet from "helmet";

import indexRouter from "./routes/index.js";
import { ensureCsrfToken, validateProductionConfig } from "./utils/security.js";

dotenv.config();
validateProductionConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
app.disable("x-powered-by");

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.locals.socialLinks = {
  instagram: process.env.INSTAGRAM_URL || "",
  tiktok: process.env.TIKTOK_URL || "",
};
app.locals.bevWhatsapp = process.env.BEV_WHATSAPP || "";

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(`${signal} received, shutting down...`);
  process.exit(0);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Unhandled promise rejection handler
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Promise Rejection:", err);
  if (!process.env.VERCEL) {
    process.exit(1);
  }
});

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://firebasestorage.googleapis.com"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: "25kb", parameterLimit: 80 }));
app.use(express.json({ limit: "25kb" }));
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: process.env.NODE_ENV === "production" ? "7d" : 0,
    index: false,
  })
);
app.use(ensureCsrfToken);
app.use((req, res, next) => {
  if (req.method === "GET" && req.accepts("html")) {
    res.setHeader("Cache-Control", "no-store");
  }

  next();
});

// EJS Layout configuration
app.use(expressLayouts);
app.set("layout", "main");  // Use main.ejs as the layout
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Routes
app.use("/", indexRouter);

// Health check
app.get("/health", (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(200).json({ status: "OK" });
  }

  res.status(200).json({
    status: "OK",
    uptime: process.uptime(),
    storage: "firebase",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render("404", { title: "Page not found", active: "" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err.stack);
  res.status(500).send("500 - Internal Server Error");
});

// Vercel imports the app as a serverless function. Local development still
// starts the normal Express listener.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
