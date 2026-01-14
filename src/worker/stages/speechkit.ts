import path from "node:path";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";

export interface SpeechKitConfig {
  apiKey: string;
  folderId: string;
  language?: string;
  profanityFilter?: boolean;
  diarization?: boolean;
  model?: string;
  grpcEndpoint?: string;
  operationEndpoint?: string;
}

export interface SpeechKitOperationStatus {
  done: boolean;
  error?: unknown;
}

export interface RecognitionSegment {
  startTimeSec: number | null;
  endTimeSec: number | null;
  speaker: string | null;
  text: string;
}

export interface RecognitionResult {
  text: string;
  segments: RecognitionSegment[];
}

const PROTO_DIR = path.resolve(process.cwd(), "protos");
const PROTO_FILES = [
  "yandex/cloud/ai/stt/v3/stt_service.proto",
  "yandex/cloud/ai/stt/v3/stt.proto",
  "yandex/cloud/operation/operation_service.proto",
  "yandex/cloud/operation/operation.proto",
  "yandex/cloud/api/operation.proto",
  "yandex/cloud/validation.proto",
  "google/api/annotations.proto",
  "google/api/http.proto",
  "google/protobuf/empty.proto",
  "google/protobuf/any.proto",
  "google/protobuf/timestamp.proto",
  "google/rpc/status.proto",
];

const packageDefinition = protoLoader.loadSync(PROTO_FILES, {
  includeDirs: [PROTO_DIR],
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const grpcObject = grpc.loadPackageDefinition(packageDefinition) as any;

let asyncRecognizerClient: any;
let operationClient: any;

function getClients(config: SpeechKitConfig): {
  asyncRecognizer: any;
  operationService: any;
} {
  const creds = grpc.credentials.createSsl();
  const sttEndpoint = config.grpcEndpoint ?? "stt.api.cloud.yandex.net:443";
  const operationEndpoint = config.operationEndpoint ?? "operation.api.cloud.yandex.net:443";

  if (!asyncRecognizerClient) {
    asyncRecognizerClient = new grpcObject.speechkit.stt.v3.AsyncRecognizer(
      sttEndpoint,
      creds,
    );
  }
  if (!operationClient) {
    operationClient = new grpcObject.yandex.cloud.operation.OperationService(
      operationEndpoint,
      creds,
    );
  }

  return { asyncRecognizer: asyncRecognizerClient, operationService: operationClient };
}

function authMetadata(apiKey: string): grpc.Metadata {
  const meta = new grpc.Metadata();
  meta.set("authorization", `Api-Key ${apiKey}`);
  return meta;
}

export async function startLongRunningRecognize(
  audioUri: string,
  config: SpeechKitConfig,
): Promise<string> {
  const { asyncRecognizer } = getClients(config);
  const metadata = authMetadata(config.apiKey);

  const request = {
    uri: audioUri,
    recognition_model: {
      model: config.model ?? "general",
      audio_format: {
        container_audio: {
          container_audio_type: "OGG_OPUS",
        },
      },
      text_normalization: {
        profanity_filter: config.profanityFilter ?? false,
        text_normalization: "TEXT_NORMALIZATION_DISABLED",
      },
      language_restriction: {
        restriction_type: "WHITELIST",
        language_code: [config.language ?? "ru-RU"],
      },
      audio_processing_type: "FULL_DATA",
    },
    speaker_labeling: {
      speaker_labeling:
        config.diarization ?? true
          ? "SPEAKER_LABELING_ENABLED"
          : "SPEAKER_LABELING_DISABLED",
    },
  };

  const response: any = await new Promise((resolve, reject) => {
    asyncRecognizer.RecognizeFile(request, metadata, (err: Error, res: unknown) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(res);
    });
  });

  if (!response?.id) {
    throw new Error("SpeechKit did not return operation id");
  }

  return response.id as string;
}

export async function getOperationStatus(
  operationId: string,
  config: SpeechKitConfig,
): Promise<SpeechKitOperationStatus> {
  const { operationService } = getClients(config);
  const metadata = authMetadata(config.apiKey);

  const response: any = await new Promise((resolve, reject) => {
    operationService.Get({ operation_id: operationId }, metadata, (err: Error, res: unknown) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(res);
    });
  });

  return {
    done: Boolean(response?.done),
    error: response?.error ?? null,
  };
}

export async function getRecognitionResult(
  operationId: string,
  config: SpeechKitConfig,
): Promise<RecognitionResult> {
  const { asyncRecognizer } = getClients(config);
  const metadata = authMetadata(config.apiKey);

  const stream = asyncRecognizer.GetRecognition({ operation_id: operationId }, metadata);
  const responses: any[] = [];

  await new Promise<void>((resolve, reject) => {
    stream.on("data", (data: unknown) => {
      responses.push(data);
    });
    stream.on("error", (err: Error) => reject(err));
    stream.on("end", () => resolve());
  });

  return parseStreamingResponses(responses);
}

function parseStreamingResponses(responses: any[]): RecognitionResult {
  const segments: RecognitionSegment[] = [];

  for (const response of responses) {
    const channelTag = response?.channel_tag ? String(response.channel_tag) : null;
    const update = response?.final ?? response?.final_refinement ?? null;
    const alternatives = update?.alternatives ?? [];
    if (!Array.isArray(alternatives) || alternatives.length === 0) {
      continue;
    }
    const alt = alternatives[0];
    const startMs = alt.start_time_ms ?? alt.words?.[0]?.start_time_ms ?? null;
    const endMs =
      alt.end_time_ms ??
      alt.words?.[alt.words.length - 1]?.end_time_ms ??
      null;
    const text = alt.text ?? "";
    if (!text) {
      continue;
    }
    segments.push({
      startTimeSec: toSeconds(startMs),
      endTimeSec: toSeconds(endMs),
      speaker: channelTag ? `SPK${channelTag}` : null,
      text,
    });
  }

  return {
    text: segments.map((segment) => segment.text).join(" ").trim(),
    segments,
  };
}

function toSeconds(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed / 1000 : null;
}
