import { getOpenAIClient, getOpenAIModelForAnalysis } from "./openaiClient";
import { SALES_CALL_REVIEW_SCHEMA } from "./analysisSchema";
import { extractOutputText, safeParseJson } from "./responseUtils";

export type AnalyzeTranscriptResult = {
  outputText: string;
  outputJson: unknown;
};

export async function analyzeTranscript(input: {
  systemPrompt: string;
  userPrompt: string;
}): Promise<AnalyzeTranscriptResult> {
  const client = getOpenAIClient();
  const model = getOpenAIModelForAnalysis();

  const response = await client.responses.create({
    model,
    input: [
      {
        role: "system",
        content: input.systemPrompt,
      },
      {
        role: "user",
        content: input.userPrompt,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        json_schema: {
          name: "sales_call_review_ru_v1",
          schema: SALES_CALL_REVIEW_SCHEMA,
          strict: true,
        },
      },
    },
  });

  const outputText = extractOutputText(response);
  const parsed = safeParseJson(outputText);
  return {
    outputText,
    outputJson: parsed ?? { raw_text: outputText },
  };
}
