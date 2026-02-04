export function safeParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function extractOutputText(response: unknown): string {
  if (
    response &&
    typeof response === "object" &&
    "output_text" in response &&
    typeof (response as { output_text?: unknown }).output_text === "string"
  ) {
    return (response as { output_text: string }).output_text;
  }

  const output = (response as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    return "";
  }

  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }
    if (
      "type" in item &&
      (item as { type?: unknown }).type === "message" &&
      "content" in item &&
      Array.isArray((item as { content?: unknown }).content)
    ) {
      const content = (item as { content: Array<{ type?: string; text?: string }> })
        .content;
      const text = content
        .map((part) => (part.type === "output_text" ? part.text ?? "" : ""))
        .join("")
        .trim();
      if (text) {
        return text;
      }
    }
  }

  return "";
}
