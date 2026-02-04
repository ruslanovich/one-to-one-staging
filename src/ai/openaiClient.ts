import OpenAI from "openai";
import { requireEnv } from "../config/env";

let cachedClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  }
  return cachedClient;
}

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
}

export function getOpenAIModelForCustomization(): string {
  return process.env.OPENAI_MODEL_CUSTOMIZATION ?? getOpenAIModel();
}

export function getOpenAIModelForAnalysis(): string {
  return process.env.OPENAI_MODEL_ANALYSIS ?? getOpenAIModel();
}
