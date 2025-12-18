import { Router } from "express";
import { getHealth } from "../controllers/health.controller";
import { AuthController } from "../controllers/auth.controller";
import { AccountController } from "../controllers/account.controller";
import { OtpController } from "../controllers/otp.controller";
import authMiddleware from "../middleware/auth.middleware";
import adminMiddleware from "../middleware/admin.middleware";
import {
  loginRateLimiter,
  passwordResetRateLimiter,
} from "../middleware/rate-limit.middleware";
import { ApplicationController } from "../controllers/application.controller";
import { ApplicationLetterController } from "../controllers/application-letter.controller";
import { UploadController } from "../controllers/upload.controller";
import {
  handleTempUpload,
  handleBlogUpload,
} from "../middleware/upload.middleware";
import { PortfolioController } from "../controllers/portfolio.controller";
import { CvController } from "../controllers/cv.controller";
import { PublicController } from "../controllers/public.controller";
import { DashboardController } from "../controllers/dashboard.controller";
import { BlogController } from "../controllers/blog.controller";
// Admin controllers
import { DashboardController as AdminDashboardController } from "../controllers/admin/dashboard.controller";
import { UserController } from "../controllers/admin/user.controller";
import { TemplateController } from "../controllers/admin/template.controller";
import { BlogController as AdminBlogController } from "../controllers/admin/blog.controller";
import { BlogCategoryController } from "../controllers/admin/blog-category.controller";
import { BlogTagController } from "../controllers/admin/blog-tag.controller";

const router = Router();

router.get("/health", getHealth);

router.post(
  "/uploads",
  authMiddleware,
  handleTempUpload,
  UploadController.uploadTemp
);

// Public API
router.get("/u/@:username", PublicController.getPortfolioListing);
router.get("/u/@:username/:id", PublicController.getPortfolioDetail);

// Stats API (public, no authentication required)
router.get("/stats", PublicController.getStats);

// Dashboard API (authenticated users)
router.get("/dashboard", authMiddleware, DashboardController.getStats);

// Templates API (public, no authentication required)
router.get("/templates", PublicController.getTemplates);

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
router.get("/account/me", authMiddleware, AccountController.me);
router.put("/account/me", authMiddleware, AccountController.updateMe);
router.put(
  "/account/change-password",
  authMiddleware,
  AccountController.changePassword
);

// OTP API
router.post("/auth/verify-otp", loginRateLimiter, OtpController.verifyOtp);
router.post(
  "/auth/resend-otp",
  passwordResetRateLimiter,
  OtpController.resendOtp
);

// Applications API
router.get("/applications", authMiddleware, ApplicationController.list);
router.post("/applications", authMiddleware, ApplicationController.create);
router.get(
  "/applications/stats",
  authMiddleware,
  ApplicationController.getStats
);
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

// Blogs API
router.get("/blogs", BlogController.list);
router.get("/blogs/:slug", BlogController.getBySlug);
router.get("/blogs/categories", BlogController.getCategories);
router.get("/blogs/tags", BlogController.getTags);

// Blogs API
router.post("/blogs", authMiddleware, BlogController.create);
router.get("/blogs/admin/:id", authMiddleware, BlogController.get);
router.put("/blogs/admin/:id", authMiddleware, BlogController.update);
router.delete("/blogs/admin/:id", authMiddleware, BlogController.delete);

// Admin API
router.get(
  "/admin/dashboard",
  authMiddleware,
  adminMiddleware,
  AdminDashboardController.getStats
);

// Admin Users API
router.get(
  "/admin/users",
  authMiddleware,
  adminMiddleware,
  UserController.list
);
router.post(
  "/admin/users",
  authMiddleware,
  adminMiddleware,
  UserController.create
);
router.get(
  "/admin/users/:id",
  authMiddleware,
  adminMiddleware,
  UserController.get
);
router.put(
  "/admin/users/:id",
  authMiddleware,
  adminMiddleware,
  UserController.update
);
router.delete(
  "/admin/users/:id",
  authMiddleware,
  adminMiddleware,
  UserController.delete
);

// Admin Templates API
router.get(
  "/admin/templates",
  authMiddleware,
  adminMiddleware,
  TemplateController.list
);
router.post(
  "/admin/templates",
  authMiddleware,
  adminMiddleware,
  TemplateController.create
);
router.get(
  "/admin/templates/:id",
  authMiddleware,
  adminMiddleware,
  TemplateController.get
);
router.put(
  "/admin/templates/:id",
  authMiddleware,
  adminMiddleware,
  TemplateController.update
);
router.delete(
  "/admin/templates/:id",
  authMiddleware,
  adminMiddleware,
  TemplateController.delete
);

// Admin Blogs API
router.get(
  "/admin/blogs",
  authMiddleware,
  adminMiddleware,
  AdminBlogController.list
);
router.post(
  "/admin/blogs",
  authMiddleware,
  adminMiddleware,
  AdminBlogController.create
);
router.get(
  "/admin/blogs/:id",
  authMiddleware,
  adminMiddleware,
  AdminBlogController.get
);
router.put(
  "/admin/blogs/:id",
  authMiddleware,
  adminMiddleware,
  AdminBlogController.update
);
router.delete(
  "/admin/blogs/:id",
  authMiddleware,
  adminMiddleware,
  AdminBlogController.delete
);

// Admin Blog Upload API
router.post(
  "/admin/blogs/uploads",
  authMiddleware,
  adminMiddleware,
  handleBlogUpload,
  UploadController.uploadBlog
);

// Admin Blog Categories API
router.get(
  "/admin/blog-categories",
  authMiddleware,
  adminMiddleware,
  BlogCategoryController.list
);
router.post(
  "/admin/blog-categories",
  authMiddleware,
  adminMiddleware,
  BlogCategoryController.create
);
router.get(
  "/admin/blog-categories/:id",
  authMiddleware,
  adminMiddleware,
  BlogCategoryController.get
);
router.put(
  "/admin/blog-categories/:id",
  authMiddleware,
  adminMiddleware,
  BlogCategoryController.update
);
router.delete(
  "/admin/blog-categories/:id",
  authMiddleware,
  adminMiddleware,
  BlogCategoryController.delete
);

// Admin Blog Tags API
router.get(
  "/admin/blog-tags",
  authMiddleware,
  adminMiddleware,
  BlogTagController.list
);
router.post(
  "/admin/blog-tags",
  authMiddleware,
  adminMiddleware,
  BlogTagController.create
);
router.get(
  "/admin/blog-tags/:id",
  authMiddleware,
  adminMiddleware,
  BlogTagController.get
);
router.put(
  "/admin/blog-tags/:id",
  authMiddleware,
  adminMiddleware,
  BlogTagController.update
);
router.delete(
  "/admin/blog-tags/:id",
  authMiddleware,
  adminMiddleware,
  BlogTagController.delete
);

export default router;
