import { promises as fs } from "node:fs";

export type AnalysisPromptParts = {
  systemPrompt: string;
  userPromptTemplate: string;
};

let cachedPrompt: AnalysisPromptParts | null = null;

export async function loadAnalysisPrompt(): Promise<AnalysisPromptParts> {
  if (cachedPrompt) {
    return cachedPrompt;
  }

  const promptUrl = new URL("./prompts/analysis.txt", import.meta.url);
  const contents = await fs.readFile(promptUrl, "utf8");
  const trimmed = contents.trim();
  if (!trimmed) {
    throw new Error("analysis prompt file is empty");
  }

  const parts = splitPromptSections(trimmed);
  cachedPrompt = parts;
  return parts;
}

export function renderUserPrompt(
  template: string,
  input: {
    transcriptFilename: string;
    salesRepName: string;
    transcriptText: string;
    callId?: string;
    source?: string;
  },
): string {
  return template
    .replaceAll("{TRANSCRIPT_FILENAME}", input.transcriptFilename)
    .replaceAll("{SALES_REP_NAME}", input.salesRepName)
    .replaceAll("{TRANSCRIPT_TEXT}", input.transcriptText)
    .replaceAll("{CALL_ID}", input.callId ?? "")
    .replaceAll("{SOURCE}", input.source ?? "");
}

function splitPromptSections(text: string): AnalysisPromptParts {
  const lines = text.split(/\r?\n/);
  const systemIndex = lines.findIndex((line) =>
    line.trim().toLowerCase().startsWith("system prompt"),
  );
  const userIndex = lines.findIndex((line) =>
    line.trim().toLowerCase().startsWith("user prompt"),
  );

  if (userIndex === -1) {
    throw new Error("analysis prompt file must include a User prompt section");
  }

  const systemStart = systemIndex >= 0 ? systemIndex + 1 : 0;
  const systemLines = lines.slice(systemStart, userIndex);
  const userLines = lines.slice(userIndex + 1);

  const systemPrompt = systemLines.join("\n").trim();
  const userPromptTemplate = userLines.join("\n").trim();

  if (!systemPrompt) {
    throw new Error("system prompt section is empty");
  }
  if (!userPromptTemplate) {
    throw new Error("user prompt section is empty");
  }

  return { systemPrompt, userPromptTemplate };
}
