import type { User, UserSocialLink } from "../generated/prisma/client";

export type UserProfile = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: User["role"];
  phone: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  gender: User["gender"] | null;
  avatar: string | null;
  status: User["status"];
  created_at: string | null;
  updated_at: string | null;
  birth_date: string | null;
  email_verified_at: string | null;
  status_reason: string | null;
  suspended_until: string | null;
  social_links: {
    id: string;
    user_id: string;
    platform: string;
    url: string;
  }[];
};

export type AccountUserProfile = UserProfile & {
  subscription_plan: User["subscriptionPlan"];
  subscription_expires_at: string | null;
  download_total_count: number;
  download_today_count: number;
};

type UserProfileSource = Pick<
  User,
  | "id"
  | "name"
  | "username"
  | "email"
  | "role"
  | "phone"
  | "headline"
  | "bio"
  | "location"
  | "gender"
  | "avatar"
  | "status"
  | "birthDate"
  | "emailVerifiedAt"
  | "statusReason"
  | "suspendedUntil"
> & {
  createdAt: Date | null;
  updatedAt: Date | null;
};

type AccountUserProfileSource = UserProfileSource &
  Pick<User, "subscriptionPlan" | "subscriptionExpiresAt">;

export const toUserProfile = (
  user: UserProfileSource,
  socialLinks: Pick<
    UserSocialLink,
    "id" | "userId" | "platform" | "url"
  >[]
): UserProfile => ({
  id: user.id,
  name: user.name,
  username: user.username,
  email: user.email,
  phone: user.phone,
  headline: user.headline,
  bio: user.bio,
  location: user.location,
  gender: user.gender,
  role: user.role,
  avatar: user.avatar,
  status: user.status,
  status_reason: user.statusReason,
  suspended_until: user.suspendedUntil ? user.suspendedUntil.toISOString() : null,
  birth_date: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
  email_verified_at: user.emailVerifiedAt
    ? user.emailVerifiedAt.toISOString()
    : null,
  social_links: socialLinks.map((record) => ({
    id: record.id,
    user_id: record.userId,
    platform: record.platform,
    url: record.url,
  })),
  created_at: user.createdAt ? user.createdAt.toISOString() : null,
  updated_at: user.updatedAt ? user.updatedAt.toISOString() : null,
});

export const toAccountUserProfile = (
  user: AccountUserProfileSource,
  socialLinks: Pick<
    UserSocialLink,
    "id" | "userId" | "platform" | "url"
  >[],
  downloadCounts: Pick<
    AccountUserProfile,
    "download_total_count" | "download_today_count"
  >
): AccountUserProfile => ({
  ...toUserProfile(user, socialLinks),
  subscription_plan: user.subscriptionPlan,
  subscription_expires_at: user.subscriptionExpiresAt
    ? user.subscriptionExpiresAt.toISOString()
    : null,
  ...downloadCounts,
});
