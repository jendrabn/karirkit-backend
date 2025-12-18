import type { Template, Prisma } from "../generated/prisma/client";
import { prisma } from "../config/prisma.config";
import { ResponseError } from "../utils/response-error.util";
import { validate } from "../utils/validate.util";
import { z } from "zod";

type GetTemplatesRequest = {
  type?: "cv" | "application_letter";
  language?: "en" | "id";
};

const GetTemplatesQuery = z.object({
  type: z.enum(["cv", "application_letter"]).optional(),
  language: z.enum(["en", "id"]).optional(),
});

export class TemplateService {
  static async getTemplates(query: GetTemplatesRequest): Promise<
    {
      id: string;
      name: string;
      slug: string;
      type: "cv" | "application_letter";
      language: "en" | "id";
      isPremium: boolean;
      preview: string | null;
      createdAt: Date | null;
      updatedAt: Date | null;
    }[]
  > {
    const requestData = validate(GetTemplatesQuery, query);

    const where: Prisma.TemplateWhereInput = {
      deletedAt: null,
    };

    if (requestData.type) {
      where.type = requestData.type;
    }

    if (requestData.language) {
      where.language = requestData.language;
    }

    const templates = await prisma.template.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        language: true,
        isPremium: true,
        preview: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return templates;
  }
}
