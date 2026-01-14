import {
  getOperationStatus,
  getRecognitionResult,
  startLongRunningRecognize,
} from "./speechkit";

export interface TranscriptionResult {
  text: string;
  language?: string;
  provider: "speechkit" | "manual";
  raw?: unknown;
  segments?: Array<{
    startTimeSec: number | null;
    endTimeSec: number | null;
    speaker: string | null;
    text: string;
  }>;
}

export interface TranscribeInput {
  audioUri?: string;
  payload: Record<string, unknown>;
}

export interface TranscribeStartResult {
  operationId: string;
}

export async function startTranscription(
  input: TranscribeInput,
): Promise<TranscribeStartResult> {
  const manualText = input.payload?.transcriptText;
  if (typeof manualText === "string" && manualText.trim().length > 0) {
    return { operationId: "manual" };
  }

  const apiKey = process.env.SPEECHKIT_API_KEY;
  const folderId = process.env.SPEECHKIT_FOLDER_ID;
  const language = process.env.SPEECHKIT_LANGUAGE ?? "ru-RU";
  const profanityFilter = process.env.SPEECHKIT_PROFANITY_FILTER === "true";
  const diarization = process.env.SPEECHKIT_DIARIZATION !== "false";
  const grpcEndpoint = process.env.SPEECHKIT_GRPC_ENDPOINT;
  const operationEndpoint = process.env.SPEECHKIT_OPERATION_ENDPOINT;
  const model = process.env.SPEECHKIT_MODEL ?? "general";
  if (!apiKey || !folderId) {
    throw new Error(
      "SpeechKit is not configured. Set SPEECHKIT_API_KEY and SPEECHKIT_FOLDER_ID.",
    );
  }

  if (!input.audioUri) {
    throw new Error("SpeechKit async transcription requires audioUri");
  }

  const operationId = await startLongRunningRecognize(
    input.audioUri,
    {
      apiKey,
      folderId,
      language,
      profanityFilter,
      diarization,
      model,
      grpcEndpoint,
      operationEndpoint,
    },
  );

  return { operationId };
}

export async function pollTranscription(
  operationId: string,
  payload: Record<string, unknown>,
): Promise<TranscriptionResult | null> {
  const apiKey = process.env.SPEECHKIT_API_KEY;
  const folderId = process.env.SPEECHKIT_FOLDER_ID;
  const language = process.env.SPEECHKIT_LANGUAGE ?? "ru-RU";
  const grpcEndpoint = process.env.SPEECHKIT_GRPC_ENDPOINT;
  const operationEndpoint = process.env.SPEECHKIT_OPERATION_ENDPOINT;
  const model = process.env.SPEECHKIT_MODEL ?? "general";

  if (!apiKey || !folderId) {
    throw new Error(
      "SpeechKit is not configured. Set SPEECHKIT_API_KEY and SPEECHKIT_FOLDER_ID.",
    );
  }

  const status = await getOperationStatus(operationId, {
    apiKey,
    folderId,
    language,
    model,
    grpcEndpoint,
    operationEndpoint,
  });

  const debug = payload?.debugSpeechkit === true || process.env.SPEECHKIT_DEBUG === "true";
  if (debug) {
    console.log("speechkit operation status", {
      done: status.done,
      hasError: Boolean(status.error),
    });
  }

  if (!status.done) {
    return null;
  }

  if (status.error) {
    throw new Error(`SpeechKit operation failed: ${JSON.stringify(status.error)}`);
  }

  const recognition = await getRecognitionResult(operationId, {
    apiKey,
    folderId,
    language,
    model,
    grpcEndpoint,
    operationEndpoint,
  });

  if (!recognition.text) {
    const allowEmpty = payload?.allowEmptyTranscript === true;
    if (!allowEmpty) {
      throw new Error("SpeechKit returned empty transcript");
    }
  }

  return {
    text: recognition.text,
    language,
    provider: "speechkit",
    segments: recognition.segments,
  };
}
