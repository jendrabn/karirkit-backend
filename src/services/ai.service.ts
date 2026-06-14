import type { Language } from "../generated/prisma/client";
import { prisma } from "../config/prisma.config";
import env from "../config/env.config";
import {
  getAiImprovementLimit,
  isUnlimitedLimit,
  resolvePlanId,
  type AiImprovementKind,
} from "../config/subscription-plans.config";
import { ResponseError } from "../utils/response-error.util";
import { appLogger } from "../middleware/logger.middleware";
import {
  AiImprovementValidation,
  type ApplicationLetterAiImprovementDataInput,
  type CvAiImprovementDataInput,
} from "../validations/ai-improvement.validation";
import { createAiCompletion } from "./ai-provider";
import {
  buildApplicationLetterImprovementPrompt,
  buildCvImprovementPrompt,
  type AiPromptBundle,
} from "./ai-prompts";

const buildTodayStart = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const extractJsonObject = (content: string): unknown => {
  const withoutFence = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");

  if (start < 0 || end < start) {
    throw new Error("AI response does not contain a JSON object");
  }

  return JSON.parse(withoutFence.slice(start, end + 1));
};

const getErrorSummary = (error: unknown): Record<string, unknown> => {
  const candidate =
    typeof error === "object" && error !== null
      ? (error as {
          name?: unknown;
          message?: unknown;
          status?: unknown;
          code?: unknown;
          stack?: unknown;
        })
      : null;

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      status: candidate?.status,
      code: candidate?.code,
      stack: error.stack,
    };
  }

  if (candidate) {
    return {
      name: candidate.name,
      message: candidate.message,
      status: candidate.status,
      code: candidate.code,
    };
  }

  return { message: String(error) };
};

const getErrorStatus = (error: unknown): number | undefined => {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const candidate = error as { status?: unknown; code?: unknown };
  if (typeof candidate.status === "number") {
    return candidate.status;
  }

  if (typeof candidate.code === "number") {
    return candidate.code;
  }

  const message = error instanceof Error ? error.message : "";
  const statusMatch = message.match(/\b(4\d{2}|5\d{2})\b/);
  return statusMatch ? Number(statusMatch[1]) : undefined;
};

const buildAiProcessingError = (error: unknown): ResponseError => {
  const status = getErrorStatus(error);

  if (status === 401 || status === 403) {
    return new ResponseError(
      500,
      "Konfigurasi provider AI tidak valid atau tidak memiliki akses ke model",
      undefined,
      { code: "AI_CONFIGURATION_ERROR" }
    );
  }

  if (status === 429) {
    return new ResponseError(
      429,
      "Provider AI sedang membatasi permintaan. Silakan coba lagi nanti atau gunakan model/provider lain.",
      undefined,
      { code: "AI_PROVIDER_RATE_LIMIT" }
    );
  }

  if (status && status >= 500) {
    return new ResponseError(
      503,
      "Provider AI sedang tidak tersedia. Silakan coba lagi nanti.",
      undefined,
      { code: "AI_PROVIDER_UNAVAILABLE" }
    );
  }

  return new ResponseError(
    500,
    "AI gagal memproses data",
    undefined,
    { code: "AI_PROCESSING_ERROR" }
  );
};

const runPrompt = async (prompt: AiPromptBundle): Promise<unknown> => {
  try {
    const response = await createAiCompletion({
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      maxTokens: env.ai.maxOutputTokens,
      temperature: env.ai.temperature,
    });

    return extractJsonObject(response.content);
  } catch (error) {
    if (error instanceof ResponseError) {
      throw error;
    }

    appLogger.error("AI improvement processing failed", {
      provider: env.ai.provider,
      model: env.ai.model,
      error: getErrorSummary(error),
    });

    throw buildAiProcessingError(error);
  }
};

export class AiService {
  static async improveCv(
    data: CvAiImprovementDataInput,
    language: Language,
    targetPosition?: string,
    jobDescription?: string
  ): Promise<CvAiImprovementDataInput> {
    const parsed = await runPrompt(
      buildCvImprovementPrompt({
        data,
        language,
        targetPosition,
        jobDescription,
      })
    );

    const result = AiImprovementValidation.CV_DATA.safeParse(parsed);
    if (!result.success) {
      throw new ResponseError(
        500,
        "AI mengembalikan format CV yang tidak valid",
        undefined,
        { code: "AI_PROCESSING_ERROR" }
      );
    }

    return result.data;
  }

  static async improveApplicationLetter(
    data: ApplicationLetterAiImprovementDataInput,
    language: Language,
    targetPosition?: string,
    jobDescription?: string
  ): Promise<ApplicationLetterAiImprovementDataInput> {
    const parsed = await runPrompt(
      buildApplicationLetterImprovementPrompt({
        data,
        language,
        targetPosition,
        jobDescription,
      })
    );

    const result =
      AiImprovementValidation.APPLICATION_LETTER_DATA.safeParse(parsed);
    if (!result.success) {
      throw new ResponseError(
        500,
        "AI mengembalikan format surat lamaran yang tidak valid",
        undefined,
        { code: "AI_PROCESSING_ERROR" }
      );
    }

    return result.data;
  }

  static async checkAiUsageLimit(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionPlan: true },
    });

    if (!user) {
      throw new ResponseError(404, "User not found");
    }

    const planId = resolvePlanId(user.subscriptionPlan);
    const limit = getAiImprovementLimit(planId);
    if (isUnlimitedLimit(limit)) {
      return;
    }

    const todayCount = await prisma.aiImprovementLog.count({
      where: {
        userId,
        usedAt: {
          gte: buildTodayStart(),
        },
      },
    });

    if (todayCount >= limit) {
      throw new ResponseError(
        429,
        `Batas perbaikan AI harian tercapai. Anda sudah menggunakan ${todayCount} dari ${limit} perbaikan hari ini. Silakan coba lagi besok.`,
        undefined,
        { code: "AI_LIMIT_REACHED" }
      );
    }
  }

  static async logAiUsage(
    userId: string,
    type: AiImprovementKind
  ): Promise<void> {
    await prisma.aiImprovementLog.create({
      data: {
        userId,
        type,
      },
    });
  }
}
