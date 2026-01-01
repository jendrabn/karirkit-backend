import type { SafeUser } from "../utils/user.util";

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
