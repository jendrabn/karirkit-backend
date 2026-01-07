import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import path from "path";
import env from "./config/env.config";
import { docsMiddleware, renderDocs } from "./controllers/docs.controller";
import requestLogger from "./middleware/logger.middleware";
import { globalRateLimiter } from "./middleware/rate-limit.middleware";
import bigIntMiddleware from "./middleware/bigint.middleware";
import routes from "./routes/api.routes";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error-handler.middleware";
import "./queues/email.queue";

const app = express();

// Configure CORS to allow credentials
console.log("CORS Origins:", env.corsOrigins);
app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  })
);
app.use(requestLogger);
app.use(globalRateLimiter);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(bigIntMiddleware);

const publicDirectory = path.resolve(__dirname, "..", "public");
app.use(express.static(publicDirectory, { index: false }));

app.use("/docs", docsMiddleware, renderDocs);
app.get("/", notFoundHandler);
app.use("/", routes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
