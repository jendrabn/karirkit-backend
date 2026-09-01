import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import env from "../config/env.config";
import { ResponseError } from "../utils/response-error.util";

export type AiProvider = "deepseek" | "glm" | "openrouter";

const PROVIDER_BASE_URLS: Record<AiProvider, string> = {
  deepseek: "https://api.deepseek.com",
  glm: "https://open.bigmodel.cn/api/paas/v4/",
  openrouter: "https://openrouter.ai/api/v1",
};

const AI_PROVIDERS = new Set<AiProvider>(["deepseek", "glm", "openrouter"]);

const resolveProvider = (): AiProvider => {
  if (AI_PROVIDERS.has(env.ai.provider as AiProvider)) {
    return env.ai.provider as AiProvider;
  }

  throw new ResponseError(500, "Provider AI tidak didukung", undefined, {
    code: "AI_PROVIDER_UNSUPPORTED",
  });
};

const ensureApiKey = (): string => {
  if (env.ai.apiKey) {
    return env.ai.apiKey;
  }

  throw new ResponseError(
    500,
    "Konfigurasi API key AI belum tersedia",
    undefined,
    { code: "AI_CONFIGURATION_ERROR" }
  );
};

export const resolveLanguageModel = (): LanguageModel => {
  const provider = resolveProvider();
  const apiKey = ensureApiKey();
  const modelName = env.ai.model;

  const openai = createOpenAI({
    apiKey,
    baseURL: env.ai.baseUrl ?? PROVIDER_BASE_URLS[provider],
  });

  return openai(modelName);
};
