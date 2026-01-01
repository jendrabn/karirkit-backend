import type { User } from "../generated/prisma/client";

export type SafeUser = Omit<
  User,
  "password" | "createdAt" | "updatedAt" | "emailVerifiedAt"
> & {
  created_at: Date;
  updated_at: Date;
  email_verified_at: Date | null;
};

export const toSafeUser = (user: User): SafeUser => {
  const { password: _password, createdAt, updatedAt, emailVerifiedAt, ...rest } =
    user;
  return {
    ...rest,
    created_at: createdAt,
    updated_at: updatedAt,
    email_verified_at: emailVerifiedAt,
  };
};
