import { Router } from "express";
import { getHealth } from "../controllers/health.controller";
import { AuthController } from "../controllers/auth.controller";
import authMiddleware from "../middleware/auth.middleware";
import {
  loginRateLimiter,
  passwordResetRateLimiter,
} from "../middleware/rate-limit.middleware";
import { ApplicationController } from "../controllers/application.controller";
import { ApplicationLetterController } from "../controllers/application-letter.controller";
import { UploadController } from "../controllers/upload.controller";
import { handleTempUpload } from "../middleware/upload.middleware";
import { PortfolioController } from "../controllers/portfolio.controller";
import { CvController } from "../controllers/cv.controller";
import { PublicController } from "../controllers/public.controller";
import { StatsController } from "../controllers/stats.controller";

const router = Router();

router.get("/health", getHealth);

router.post(
  "/uploads",
  authMiddleware,
  handleTempUpload,
  UploadController.uploadTemp
);

// Public API
router.get(
  "/public/portfolios/@:username",
  PublicController.getPortfolioListing
);
router.get(
  "/public/portfolios/@:username/:id",
  PublicController.getPortfolioDetail
);

// Stats API (public, no authentication required)
router.get("/stats", StatsController.getStats);

// Auth API
router.post("/auth/register", AuthController.register);
router.post("/auth/login", loginRateLimiter, AuthController.login);
router.post("/auth/google", AuthController.loginWithGoogle);
router.post(
  "/auth/forgot-password",
  passwordResetRateLimiter,
  AuthController.sendPasswordResetLink
);
router.post("/auth/reset-password", AuthController.resetPassword);
router.post("/auth/logout", authMiddleware, AuthController.logout);
router.get("/auth/me", authMiddleware, AuthController.me);
router.put("/auth/me", authMiddleware, AuthController.updateMe);
router.put(
  "/auth/change-password",
  authMiddleware,
  AuthController.changePassword
);

// Applications API
router.get("/applications", authMiddleware, ApplicationController.list);
router.post("/applications", authMiddleware, ApplicationController.create);
router.get("/applications/:id", authMiddleware, ApplicationController.get);
router.put("/applications/:id", authMiddleware, ApplicationController.update);
router.delete(
  "/applications/:id",
  authMiddleware,
  ApplicationController.delete
);
router.post(
  "/applications/:id/duplicate",
  authMiddleware,
  ApplicationController.duplicate
);

// Application Letters API
router.get(
  "/application-letters",
  authMiddleware,
  ApplicationLetterController.list
);
router.post(
  "/application-letters",
  authMiddleware,
  ApplicationLetterController.create
);
router.get(
  "/application-letters/:id",
  authMiddleware,
  ApplicationLetterController.get
);
router.put(
  "/application-letters/:id",
  authMiddleware,
  ApplicationLetterController.update
);
router.delete(
  "/application-letters/:id",
  authMiddleware,
  ApplicationLetterController.delete
);
router.post(
  "/application-letters/:id/duplicate",
  authMiddleware,
  ApplicationLetterController.duplicate
);
router.get(
  "/application-letters/:id/download",
  authMiddleware,
  ApplicationLetterController.download
);

// Portfolios API
router.get("/portfolios", authMiddleware, PortfolioController.list);
router.post("/portfolios", authMiddleware, PortfolioController.create);
router.get("/portfolios/:id", authMiddleware, PortfolioController.get);
router.put("/portfolios/:id", authMiddleware, PortfolioController.update);
router.delete("/portfolios/:id", authMiddleware, PortfolioController.delete);

// CVs API
router.get("/cvs", authMiddleware, CvController.list);
router.post("/cvs", authMiddleware, CvController.create);
router.get("/cvs/:id", authMiddleware, CvController.get);
router.put("/cvs/:id", authMiddleware, CvController.update);
router.delete("/cvs/:id", authMiddleware, CvController.delete);
router.post("/cvs/:id/duplicate", authMiddleware, CvController.duplicate);
router.get("/cvs/:id/download", authMiddleware, CvController.download);
router.get("/cvs/:id/preview", authMiddleware, CvController.preview);

export default router;
