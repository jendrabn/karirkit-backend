import type { User } from "../generated/prisma/client";
import type { SafeUser } from "../services/auth.service";

interface RateLimitState {
  limit: number;
  current: number;
  remaining: number;
  resetTime?: Date;
}

declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
      authToken?: string;
      rateLimit?: RateLimitState;
    }
  }
}

export {};
