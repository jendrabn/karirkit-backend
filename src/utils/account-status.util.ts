import type { User } from "../generated/prisma/client";
import { ResponseError } from "./response-error.util";

type AccountStatusContext = Pick<
  User,
  "status" | "statusReason" | "suspendedUntil"
>;

const formatReason = (reason: string | null | undefined): string =>
  reason && reason.trim().length > 0 ? `: ${reason.trim()}` : "";

export const ensureAccountIsActive = (user: AccountStatusContext): void => {
  if (user.status === "banned") {
    throw new ResponseError(
      403,
      `Akun diblokir${formatReason(user.statusReason)}`
    );
  }

  if (user.status === "suspended") {
    const untilSegment = user.suspendedUntil
      ? ` hingga ${user.suspendedUntil.toISOString()}`
      : "";
    throw new ResponseError(
      403,
      `Akun ditangguhkan sementara${untilSegment}${formatReason(
        user.statusReason
      )}`
    );
  }
};
