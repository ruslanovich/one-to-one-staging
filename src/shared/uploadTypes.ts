export type UploadKind = "video" | "audio" | "transcript";
export type UploadKindOrUnknown = UploadKind | "unknown";

const VIDEO_EXTENSIONS = new Set([".mp4", ".webm"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".ogg"]);
const TRANSCRIPT_EXTENSIONS = new Set([".vtt", ".txt"]);
const DERIVED_AUDIO_EXTENSIONS = new Set([".m4a", ".webm"]);

export function getExtension(fileName: string): string {
  const trimmed = String(fileName ?? "").trim();
  const dotIndex = trimmed.lastIndexOf(".");
  if (dotIndex === -1) {
    return "";
  }
  return trimmed.slice(dotIndex).toLowerCase();
}

export function isDerivedAudioFileName(fileName: string): boolean {
  return String(fileName ?? "").toLowerCase().includes(".audio.");
}

export function normalizeUploadKind(value: unknown): UploadKindOrUnknown {
  if (typeof value !== "string") {
    return "unknown";
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "video" || normalized === "audio" || normalized === "transcript") {
    return normalized;
  }
  return "unknown";
}

export function inferSourceKind(fileName: string): UploadKindOrUnknown {
  const ext = getExtension(fileName);
  if (TRANSCRIPT_EXTENSIONS.has(ext)) {
    return "transcript";
  }
  if (AUDIO_EXTENSIONS.has(ext)) {
    return "audio";
  }
  if (VIDEO_EXTENSIONS.has(ext)) {
    return "video";
  }
  return "unknown";
}

export function inferProcessingKind(fileName: string): UploadKindOrUnknown {
  const ext = getExtension(fileName);
  if (TRANSCRIPT_EXTENSIONS.has(ext)) {
    return "transcript";
  }
  if (isDerivedAudioFileName(fileName) && DERIVED_AUDIO_EXTENSIONS.has(ext)) {
    return "audio";
  }
  if (AUDIO_EXTENSIONS.has(ext) || ext === ".m4a") {
    return "audio";
  }
  if (VIDEO_EXTENSIONS.has(ext)) {
    return "video";
  }
  return "unknown";
}

export function validateUploadInput(input: {
  fileName: string;
  sourceFileName?: string;
  sourceKind?: unknown;
}): {
  ok: boolean;
  processingKind: UploadKindOrUnknown;
  sourceKind: UploadKindOrUnknown;
  errors: string[];
} {
  const errors: string[] = [];
  const sourceName = input.sourceFileName ?? input.fileName;
  const declaredKind = normalizeUploadKind(input.sourceKind);
  const inferredSourceKind = inferSourceKind(sourceName);
  const sourceKind = declaredKind !== "unknown" ? declaredKind : inferredSourceKind;
  const processingKind = inferProcessingKind(input.fileName);

  if (sourceKind === "unknown") {
    errors.push("unsupported source file type");
  }

  if (processingKind === "unknown") {
    errors.push("unsupported upload file type");
  }

  if (sourceKind !== "unknown") {
    const sourceExt = getExtension(sourceName);
    if (sourceKind === "video" && !VIDEO_EXTENSIONS.has(sourceExt)) {
      errors.push("source file must be .mp4 or .webm");
    }
    if (sourceKind === "audio" && !AUDIO_EXTENSIONS.has(sourceExt)) {
      errors.push("source file must be .mp3, .wav, or .ogg");
    }
    if (sourceKind === "transcript" && !TRANSCRIPT_EXTENSIONS.has(sourceExt)) {
      errors.push("source file must be .vtt or .txt");
    }

    if (sourceKind === "video" && processingKind !== "audio") {
      errors.push("video uploads must include extracted audio");
    }
    if (sourceKind === "video" && !isDerivedAudioFileName(input.fileName)) {
      errors.push("video uploads must include '.audio.' in the uploaded filename");
    }
    if (
      sourceKind === "video" &&
      (!DERIVED_AUDIO_EXTENSIONS.has(getExtension(input.fileName)) ||
        !isDerivedAudioFileName(input.fileName))
    ) {
      errors.push("video uploads must be extracted as .m4a or .webm audio");
    }
    if (sourceKind === "audio" && processingKind !== "audio") {
      errors.push("audio uploads must provide an audio file");
    }
    if (sourceKind === "transcript" && processingKind !== "transcript") {
      errors.push("transcript uploads must provide a transcript file");
    }
  }

  return {
    ok: errors.length === 0,
    processingKind,
    sourceKind,
    errors,
  };
}

export const SUPPORTED_UPLOADS = {
  video: [".mp4", ".webm"],
  audio: [".mp3", ".wav", ".ogg"],
  transcript: [".vtt", ".txt"],
};
