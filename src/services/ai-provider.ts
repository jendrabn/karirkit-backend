import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import env from "../config/env.config";
import { ResponseError } from "../utils/response-error.util";

export type AiProvider =
  | "gemini"
  | "openai"
  | "anthropic"
  | "deepseek"
  | "glm"
  | "openrouter";

const PROVIDER_BASE_URLS: Record<Exclude<AiProvider, "anthropic">, string> = {
  openai: "https://api.openai.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/",
  deepseek: "https://api.deepseek.com",
  glm: "https://open.bigmodel.cn/api/paas/v4/",
  openrouter: "https://openrouter.ai/api/v1",
};

const AI_PROVIDERS = new Set<AiProvider>([
  "gemini",
  "openai",
  "anthropic",
  "deepseek",
  "glm",
  "openrouter",
]);

export interface AiCompletionRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
}

export interface AiCompletionResponse {
  content: string;
}

const resolveProvider = (): AiProvider => {
  if (AI_PROVIDERS.has(env.ai.provider)) {
    return env.ai.provider;
  }

  throw new ResponseError(
    500,
    "Provider AI tidak didukung",
    undefined,
    { code: "AI_PROVIDER_UNSUPPORTED" }
  );
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

const buildOpenAiClient = (
  provider: Exclude<AiProvider, "anthropic">,
  apiKey: string
) =>
  new OpenAI({
    apiKey,
    baseURL: env.ai.baseUrl ?? PROVIDER_BASE_URLS[provider],
  });

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

  return undefined;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "";
};

const shouldRetryWithoutJsonMode = (
  provider: Exclude<AiProvider, "anthropic">,
  error: unknown
): boolean => {
  if (provider === "openai") {
    return false;
  }

  const status = getErrorStatus(error);
  if (status !== 400 && status !== 422) {
    return false;
  }

  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("response_format") ||
    message.includes("json_object") ||
    message.includes("json mode") ||
    message.includes("unsupported") ||
    message.includes("not supported")
  );
};

const createOpenAiCompatibleRequest = (
  request: AiCompletionRequest,
  useJsonMode: boolean
): ChatCompletionCreateParamsNonStreaming => ({
  model: env.ai.model,
  messages: [
    { role: "system", content: request.systemPrompt },
    { role: "user", content: request.userPrompt },
  ],
  temperature: request.temperature,
  max_tokens: request.maxTokens,
  ...(useJsonMode ? { response_format: { type: "json_object" } } : {}),
});

const createOpenAiCompatibleCompletion = async (
  provider: Exclude<AiProvider, "anthropic">,
  request: AiCompletionRequest
): Promise<AiCompletionResponse> => {
  const client = buildOpenAiClient(provider, ensureApiKey());
  const response = await client.chat.completions
    .create(createOpenAiCompatibleRequest(request, true))
    .catch((error: unknown) => {
      if (shouldRetryWithoutJsonMode(provider, error)) {
        return client.chat.completions.create(
          createOpenAiCompatibleRequest(request, false)
        );
      }

      throw error;
    });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new ResponseError(
      500,
      "AI tidak mengembalikan konten",
      undefined,
      { code: "AI_PROCESSING_ERROR" }
    );
  }

  return { content };
};

const createAnthropicCompletion = async (
  request: AiCompletionRequest
): Promise<AiCompletionResponse> => {
  const client = new Anthropic({
    apiKey: ensureApiKey(),
    baseURL: env.ai.baseUrl ?? "https://api.anthropic.com",
  });

  const response = await client.messages.create({
    model: env.ai.model,
    max_tokens: request.maxTokens,
    temperature: request.temperature,
    system: request.systemPrompt,
    messages: [{ role: "user", content: request.userPrompt }],
  });

  const content = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!content) {
    throw new ResponseError(
      500,
      "AI tidak mengembalikan konten",
      undefined,
      { code: "AI_PROCESSING_ERROR" }
    );
  }

  return { content };
};

export async function createAiCompletion(
  request: AiCompletionRequest
): Promise<AiCompletionResponse> {
  const provider = resolveProvider();

  if (provider === "anthropic") {
    return createAnthropicCompletion(request);
  }

  return createOpenAiCompatibleCompletion(provider, request);
}
