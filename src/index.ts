import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import path from "path";
import env from "./config/env.config";
import { docsMiddleware, renderDocs } from "./controllers/docs.controller";
import { UploadProxyController } from "./controllers/upload-proxy.controller";
import requestLogger, { errorLogger } from "./middleware/logger.middleware";
import { globalRateLimiter } from "./middleware/rate-limit.middleware";
import bigIntMiddleware from "./middleware/bigint.middleware";
import {
  maintenanceModeMiddleware,
} from "./middleware/system-guard.middleware";
import routes from "./routes/api.routes";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error-handler.middleware";
import { ResponseError } from "./utils/response-error.util";
import "./queues/email.queue";
import "./queues/subscription-expiry.queue";
import csrfProtectionMiddleware from "./middleware/csrf-protection.middleware";
import { StorageService } from "./services/storage.service";

const app = express();

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
app.use(csrfProtectionMiddleware);
app.use(bigIntMiddleware);
app.use(maintenanceModeMiddleware);

const publicDirectory = path.resolve(__dirname, "..", "public");
app.use("/uploads/documents", (_req, _res, next) => {
  next(new ResponseError(404, "File tidak ditemukan"));
});
if (StorageService.isCloudStorage()) {
  app.get("/uploads/*", UploadProxyController.serve);
}
app.use(
  express.static(publicDirectory, {
    index: false,
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  })
);

app.use("/docs", docsMiddleware, renderDocs);
app.get("/", notFoundHandler);
app.use("/", routes);
app.use(notFoundHandler);
app.use(errorLogger);
app.use(errorHandler);

export default app;
