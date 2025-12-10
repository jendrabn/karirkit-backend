import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import path from "path";
import { docsMiddleware, renderDocs } from "./controllers/docs.controller";
import requestLogger from "./middleware/logger.middleware";
import { globalRateLimiter } from "./middleware/rate-limit.middleware";
import routes from "./routes/api.routes";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error-handler.middleware";
import "./queues/email.queue";

const app = express();

app.use(cors());
app.use(requestLogger);
app.use(globalRateLimiter);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

const publicDirectory = path.resolve(__dirname, "..", "public");
app.use(express.static(publicDirectory));

app.use("/docs", docsMiddleware, renderDocs);
app.use("/", routes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
