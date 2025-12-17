import type { User, Prisma } from "../../generated/prisma/client";
import bcrypt from "bcrypt";
import { prisma } from "../../config/prisma.config";
import { ResponseError } from "../../utils/response-error.util";
import { validate } from "../../utils/validate.util";
import { AuthValidation } from "../../validations/auth.validation";
import { z } from "zod";

type SafeUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  phone: string | null;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
};

type UserListResult = {
  items: SafeUser[];
  pagination: {
    page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
  };
};

type CreateUserRequest = {
  name: string;
  username: string;
  email: string;
  password: string;
  phone?: string | null;
  role?: "user" | "admin";
  avatar?: string | null;
};

type UpdateUserRequest = {
  name?: string;
  username?: string;
  email?: string;
  phone?: string | null;
  role?: "user" | "admin";
  avatar?: string | null;
};

// Add validation schema for admin user list
const AdminUserListQuery = z.object({
  page: z.coerce.number().min(1).default(1),
  per_page: z.coerce.number().min(1).max(100).default(20),
  q: z.string().optional(),
  sort_by: z
    .enum(["created_at", "updated_at", "name", "username", "email", "role"])
    .default("created_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
  role: z.enum(["user", "admin"]).optional(),
  created_from: z.string().optional(),
  created_to: z.string().optional(),
});

const sortFieldMap = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  name: "name",
  username: "username",
  email: "email",
  role: "role",
} as const;

export class UserService {
  static async list(query: unknown): Promise<UserListResult> {
    const requestData = validate(AdminUserListQuery, query);
    const page = requestData.page;
    const perPage = requestData.per_page;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    };

    if (requestData.q) {
      const search = requestData.q;
      where.OR = [
        { name: { contains: search } },
        { username: { contains: search } },
        { email: { contains: search } },
      ];
    }

    if (requestData.role) {
      where.role = requestData.role;
    }

    if (requestData.created_from || requestData.created_to) {
      where.createdAt = {};

      if (requestData.created_from) {
        where.createdAt.gte = new Date(
          `${requestData.created_from}T00:00:00.000Z`
        );
      }

      if (requestData.created_to) {
        where.createdAt.lte = new Date(
          `${requestData.created_to}T23:59:59.999Z`
        );
      }
    }

    const sortField =
      sortFieldMap[requestData.sort_by as keyof typeof sortFieldMap] ??
      "createdAt";
    const orderBy: Prisma.UserOrderByWithRelationInput = {
      [sortField]: requestData.sort_order,
    };

    const [totalItems, records] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          role: true,
          phone: true,
          avatar: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / Math.max(perPage, 1));

    return {
      items: records.map((user) => ({
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar,
        createdAt: user.createdAt?.toISOString() || "",
        updatedAt: user.updatedAt?.toISOString() || "",
      })),
      pagination: {
        page,
        per_page: perPage,
        total_items: totalItems,
        total_pages: totalPages,
      },
    };
  }

  static async get(id: string): Promise<SafeUser> {
    const user = await prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        phone: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new ResponseError(404, "User not found");
    }

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      phone: user.phone,
      avatar: user.avatar,
      createdAt: user.createdAt?.toISOString() || "",
      updatedAt: user.updatedAt?.toISOString() || "",
    };
  }

  static async create(request: CreateUserRequest): Promise<SafeUser> {
    const requestData = validate(AuthValidation.REGISTER, request);

    // Check if email already exists
    const existingEmail = await prisma.user.count({
      where: { email: requestData.email },
    });

    if (existingEmail > 0) {
      throw new ResponseError(400, "Email already exists");
    }

    // Check if username already exists
    const existingUsername = await prisma.user.count({
      where: { username: requestData.username },
    });

    if (existingUsername > 0) {
      throw new ResponseError(400, "Username already exists");
    }

    const hashedPassword = await bcrypt.hash(requestData.password, 10);

    const user = await prisma.user.create({
      data: {
        name: requestData.name,
        username: requestData.username,
        email: requestData.email,
        password: hashedPassword,
        phone: requestData.phone ?? null,
        role: (requestData as any).role ?? "user",
        avatar: (requestData as any).avatar ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        phone: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      phone: user.phone,
      avatar: user.avatar,
      createdAt: user.createdAt?.toISOString() || "",
      updatedAt: user.updatedAt?.toISOString() || "",
    };
  }

  static async update(
    id: string,
    request: UpdateUserRequest
  ): Promise<SafeUser> {
    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existingUser) {
      throw new ResponseError(404, "User not found");
    }

    // Check if email already exists (excluding current user)
    if (request.email && request.email !== existingUser.email) {
      const emailExists = await prisma.user.count({
        where: {
          email: request.email,
          NOT: { id },
        },
      });

      if (emailExists > 0) {
        throw new ResponseError(400, "Email already exists");
      }
    }

    // Check if username already exists (excluding current user)
    if (request.username && request.username !== existingUser.username) {
      const usernameExists = await prisma.user.count({
        where: {
          username: request.username,
          NOT: { id },
        },
      });

      if (usernameExists > 0) {
        throw new ResponseError(400, "Username already exists");
      }
    }

    const updateData: Prisma.UserUpdateInput = {
      updatedAt: new Date(),
    };

    if (request.name !== undefined) {
      updateData.name = request.name;
    }

    if (request.username !== undefined) {
      updateData.username = request.username;
    }

    if (request.email !== undefined) {
      updateData.email = request.email;
    }

    if (request.phone !== undefined) {
      updateData.phone = request.phone;
    }

    if (request.role !== undefined) {
      updateData.role = request.role;
    }

    if (request.avatar !== undefined) {
      updateData.avatar = request.avatar;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        phone: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      phone: user.phone,
      avatar: user.avatar,
      createdAt: user.createdAt?.toISOString() || "",
      updatedAt: user.updatedAt?.toISOString() || "",
    };
  }

  static async delete(id: string): Promise<void> {
    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existingUser) {
      throw new ResponseError(404, "User not found");
    }

    // Soft delete
    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
