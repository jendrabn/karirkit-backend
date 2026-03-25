import type { SafeUser } from "../utils/user.util";
import type { AuthTokenSource } from "../utils/session-auth.util";

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
      authSource?: AuthTokenSource;
      rateLimit?: RateLimitState;
    }
  }
}

export {};
