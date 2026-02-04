import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { QueueJob } from "../queue/types";
import { StorageClient } from "../storage/types";
import { spawn } from "node:child_process";
import { analyzeTranscript } from "../ai/analyzeTranscript";
import { loadAnalysisPrompt, renderUserPrompt } from "../ai/analysisPrompt";
import { extractAudio } from "./stages/extractAudio";
import { persistAnalysis } from "./stages/persistAnalysis";
import {
  TranscriptionResult,
  pollTranscription,
  startTranscription,
} from "./stages/transcribe";
import type { Pool } from "pg";
import { inferProcessingKind } from "../shared/uploadTypes";

export interface RunStageDeps {
  storage: StorageClient;
  bucket: string;
  storageEndpoint: string;
  rawPath: (orgId: string, callId: string, fileName: string) => string;
  audioPath: (orgId: string, callId: string) => string;
  transcriptPath: (orgId: string, callId: string) => string;
  transcriptAudioPath: (orgId: string, callId: string) => string;
  analysisPath: (orgId: string, callId: string, analysisId?: string) => string;
  db?: Pool;
  enqueueJobAt?: (
    job: Omit<QueueJob, "id" | "status" | "attempts">,
    availableAt: Date,
  ) => Promise<void>;
  enqueueJob?: (job: Omit<QueueJob, "id" | "status" | "attempts">) => Promise<void>;
  onAudioArtifact?: (input: {
    orgId: string;
    callId: string;
    storagePath: string;
    contentType: string;
    sizeBytes?: number;
  }) => Promise<void>;
  onTranscriptArtifact?: (input: {
    orgId: string;
    callId: string;
    storagePath: string;
    contentType: string;
    sizeBytes?: number;
  }) => Promise<void>;
  onAnalysisArtifact?: (input: {
    orgId: string;
    callId: string;
    storagePath: string;
    contentType: string;
    sizeBytes?: number;
  }) => Promise<void>;
}

export async function runStage(job: QueueJob, deps: RunStageDeps): Promise<void> {
  switch (job.stage) {
    case "extract_audio":
      await runExtractAudio(job, deps);
      return;
    case "transcribe_start":
      await runTranscribeStart(job, deps);
      return;
    case "transcribe_poll":
      await runTranscribePoll(job, deps);
      return;
    case "analyze":
      await runAnalyze(job, deps);
      return;
    case "persist_analysis":
      await runPersistAnalysis(job, deps);
      return;
    default:
      throw new Error(`unknown stage: ${job.stage}`);
  }
}

async function runExtractAudio(job: QueueJob, deps: RunStageDeps): Promise<void> {
  const fileName = String(job.payload?.fileName ?? "");
  if (!fileName) {
    throw new Error("missing payload.fileName for extract_audio");
  }
  const processingKind = inferProcessingKind(fileName);
  if (processingKind === "unknown") {
    throw new Error(`unsupported file type for extract_audio: ${fileName}`);
  }
  if (processingKind === "video") {
    throw new Error(
      `video uploads must be extracted client-side before upload: ${fileName}`,
    );
  }
  const contentType =
    typeof job.payload?.contentType === "string" ? String(job.payload.contentType) : undefined;

  const rawObjectPath = deps.rawPath(job.orgId, job.callId, fileName);
  const audioObjectPath = deps.audioPath(job.orgId, job.callId);
  const audioExists = await deps.storage.exists(deps.bucket, audioObjectPath);
  if (audioExists) {
    await cleanupIfExists(deps.storage, deps.bucket, rawObjectPath);
    await enqueueTranscribeStartIfNeeded(job, deps);
    return;
  }

  const tempDir = await fs.mkdtemp(join(tmpdir(), "call-"));
  const rawFile = join(tempDir, basename(fileName));
  const audioFile = join(tempDir, `${job.callId}.mp3`);

  try {
    await deps.storage.download(deps.bucket, rawObjectPath, rawFile);
    if (processingKind === "video") {
      await extractAudio({ inputPath: rawFile, outputPath: audioFile });
      await deps.storage.upload(deps.bucket, audioObjectPath, audioFile, "audio/mpeg");
      if (deps.onAudioArtifact) {
        const stats = await fs.stat(audioFile);
        await deps.onAudioArtifact({
          orgId: job.orgId,
          callId: job.callId,
          storagePath: audioObjectPath,
          contentType: "audio/mpeg",
          sizeBytes: stats.size,
        });
      }
    } else {
      const resolvedContentType =
        contentType ?? inferAudioContentType(fileName) ?? "application/octet-stream";
      await deps.storage.upload(
        deps.bucket,
        audioObjectPath,
        rawFile,
        resolvedContentType,
      );
      if (deps.onAudioArtifact) {
        const stats = await fs.stat(rawFile);
        await deps.onAudioArtifact({
          orgId: job.orgId,
          callId: job.callId,
          storagePath: audioObjectPath,
          contentType: resolvedContentType,
          sizeBytes: stats.size,
        });
      }
    }
    await deps.storage.remove(deps.bucket, rawObjectPath);
    await enqueueTranscribeStartIfNeeded(job, deps);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function runTranscribeStart(job: QueueJob, deps: RunStageDeps): Promise<void> {
  const audioObjectPath =
    typeof job.payload?.audioObjectPath === "string" && job.payload.audioObjectPath
      ? String(job.payload.audioObjectPath)
      : deps.audioPath(job.orgId, job.callId);
  const transcriptObjectPath = deps.transcriptPath(job.orgId, job.callId);
  const transcriptAudioObjectPath = deps.transcriptAudioPath(job.orgId, job.callId);
  const transcriptExists = await deps.storage.exists(deps.bucket, transcriptObjectPath);
  if (transcriptExists) {
    await cleanupIfExists(deps.storage, deps.bucket, transcriptAudioObjectPath);
    return;
  }
  const audioExists = await deps.storage.exists(deps.bucket, audioObjectPath);
  if (!audioExists) {
    if (deps.enqueueJobAt) {
      const delayMs = Number(process.env.SPEECHKIT_POLL_INTERVAL_MS ?? "10000");
      const availableAt = new Date(Date.now() + delayMs);
      await deps.enqueueJobAt(
        {
          orgId: job.orgId,
          callId: job.callId,
          stage: "transcribe_start",
          payload: job.payload ?? {},
          maxAttempts: job.maxAttempts ?? 5,
        },
        availableAt,
      );
      return;
    }
    throw new Error(`audio object not found: ${audioObjectPath}`);
  }

  const tempDir = await fs.mkdtemp(join(tmpdir(), "call-"));
  const audioFile = join(tempDir, `${job.callId}.mp3`);
  const oggFile = join(tempDir, `${job.callId}.ogg`);
  const transcriptFile = join(tempDir, `${job.callId}.json`);

  try {
    await deps.storage.download(deps.bucket, audioObjectPath, audioFile);
    await convertToOggOpus(audioFile, oggFile);
    await deps.storage.upload(deps.bucket, transcriptAudioObjectPath, oggFile, "audio/ogg");
    const audioUri = buildStorageUri(deps.storageEndpoint, deps.bucket, transcriptAudioObjectPath);
    const startResult = await startTranscription({
      audioUri,
      payload: job.payload ?? {},
    });

    if (!deps.enqueueJobAt) {
      throw new Error("enqueueJobAt is required for transcribe_start");
    }

    const delayMs = Number(process.env.SPEECHKIT_POLL_INTERVAL_MS ?? "10000");
    const availableAt = new Date(Date.now() + delayMs);
    await deps.enqueueJobAt(
      {
        orgId: job.orgId,
        callId: job.callId,
        stage: "transcribe_poll",
        payload: {
          operationId: startResult.operationId,
          transcriptAudioObjectPath,
          transcriptObjectPath,
        },
        maxAttempts: 50,
      },
      availableAt,
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function enqueueTranscribeStartIfNeeded(
  job: QueueJob,
  deps: RunStageDeps,
): Promise<void> {
  if (!deps.enqueueJob) {
    return;
  }
  const transcriptObjectPath = deps.transcriptPath(job.orgId, job.callId);
  const transcriptExists = await deps.storage.exists(deps.bucket, transcriptObjectPath);
  if (transcriptExists) {
    return;
  }
  await deps.enqueueJob({
    orgId: job.orgId,
    callId: job.callId,
    stage: "transcribe_start",
    payload: job.payload ?? {},
    maxAttempts: 5,
  });
}

async function runTranscribePoll(job: QueueJob, deps: RunStageDeps): Promise<void> {
  const operationId = String(job.payload?.operationId ?? "");
  const transcriptObjectPath = String(job.payload?.transcriptObjectPath ?? "");
  const transcriptAudioObjectPath = String(job.payload?.transcriptAudioObjectPath ?? "");

  if (!operationId || !transcriptObjectPath || !transcriptAudioObjectPath) {
    throw new Error("missing payload fields for transcribe_poll");
  }

  const transcriptExists = await deps.storage.exists(deps.bucket, transcriptObjectPath);
  if (transcriptExists) {
    await cleanupIfExists(deps.storage, deps.bucket, transcriptAudioObjectPath);
    return;
  }

  const transcript = await pollTranscription(operationId, job.payload ?? {});
  if (!transcript) {
    if (!deps.enqueueJobAt) {
      throw new Error("enqueueJobAt is required for transcribe_poll");
    }
    const delayMs = Number(process.env.SPEECHKIT_POLL_INTERVAL_MS ?? "10000");
    const availableAt = new Date(Date.now() + delayMs);
    await deps.enqueueJobAt(
      {
        orgId: job.orgId,
        callId: job.callId,
        stage: "transcribe_poll",
        payload: job.payload,
        maxAttempts: 50,
      },
      availableAt,
    );
    return;
  }

  const tempDir = await fs.mkdtemp(join(tmpdir(), "call-"));
  const transcriptFile = join(tempDir, `${job.callId}.json`);

  try {
    await writeTranscriptFile(transcriptFile, transcript);
    await deps.storage.upload(
      deps.bucket,
      transcriptObjectPath,
      transcriptFile,
      "application/json",
    );
    if (deps.onTranscriptArtifact) {
      const stats = await fs.stat(transcriptFile);
      await deps.onTranscriptArtifact({
        orgId: job.orgId,
        callId: job.callId,
        storagePath: transcriptObjectPath,
        contentType: "application/json",
        sizeBytes: stats.size,
      });
    }
    await deps.storage.remove(deps.bucket, transcriptAudioObjectPath);
    if (deps.enqueueJob) {
      const transcriptFileName =
        transcriptObjectPath.split("/").pop() ?? `${job.callId}.json`;
      await deps.enqueueJob({
        orgId: job.orgId,
        callId: job.callId,
        stage: "analyze",
        payload: { transcriptObjectPath, transcriptFileName },
        maxAttempts: 5,
      });
    }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function convertToOggOpus(inputPath: string, outputPath: string): Promise<void> {
  const args = [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-c:a",
    "libopus",
    "-ar",
    "48000",
    "-b:a",
    "32k",
    outputPath,
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 8000) {
        stderr = stderr.slice(-8000);
      }
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg ogg conversion failed: ${stderr.trim()}`));
      }
    });
  });
}

function inferAudioContentType(fileName: string): string | undefined {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".webm")) return "audio/webm";
  return undefined;
}

function buildStorageUri(endpoint: string, bucket: string, key: string): string {
  const trimmed = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
  return `${trimmed}/${bucket}/${key}`;
}

async function writeTranscriptFile(
  filePath: string,
  transcript: TranscriptionResult,
): Promise<void> {
  const segments = transcript.segments ?? buildTranscriptSegments(transcript.raw);
  const payload = {
    language: transcript.language,
    provider: transcript.provider,
    segments,
  };
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2));
}

type SpeechKitChunk = {
  alternatives?: Array<{
    text?: string;
    confidence?: number;
    words?: Array<{ startTime?: string; endTime?: string; word?: string }>;
  }>;
  channelTag?: string;
};

function buildTranscriptSegments(raw: unknown): Array<{
  startTimeSec: number | null;
  endTimeSec: number | null;
  speaker: string | null;
  text: string;
}> {
  const chunks = (raw as { chunks?: SpeechKitChunk[] })?.chunks;
  if (!Array.isArray(chunks)) {
    return [];
  }

  const segments: Array<{
    startTimeSec: number | null;
    endTimeSec: number | null;
    speaker: string | null;
    text: string;
  }> = [];

  for (const chunk of chunks) {
    const alt = chunk.alternatives?.[0];
    const words = (alt?.words ?? []) as Array<{
      startTime?: string;
      endTime?: string;
      word?: string;
      speakerTag?: number | string;
    }>;

    if (words.length === 0) {
      continue;
    }

    let currentSpeaker: string | null = null;
    let currentText: string[] = [];
    let currentStart: string | null = null;
    let currentEnd: string | null = null;

    const flush = () => {
      if (currentText.length === 0) {
        return;
      }
      segments.push({
        startTimeSec: toSeconds(currentStart),
        endTimeSec: toSeconds(currentEnd),
        speaker: currentSpeaker,
        text: currentText.join(" ").trim(),
      });
      currentText = [];
      currentStart = null;
      currentEnd = null;
    };

    for (const word of words) {
      const speakerTag =
        word.speakerTag !== undefined && word.speakerTag !== null
          ? `SPK${word.speakerTag}`
          : chunk.channelTag
            ? `S${chunk.channelTag}`
            : null;

      if (currentSpeaker === null) {
        currentSpeaker = speakerTag;
        currentStart = word.startTime ?? null;
      }

      if (currentSpeaker !== speakerTag) {
        flush();
        currentSpeaker = speakerTag;
        currentStart = word.startTime ?? null;
      }

      currentText.push(word.word ?? "");
      currentEnd = word.endTime ?? currentEnd;
    }

    flush();
  }

  return segments.filter((segment) => segment.text);
}

async function cleanupIfExists(
  storage: StorageClient,
  bucket: string,
  path: string,
): Promise<void> {
  try {
    const exists = await storage.exists(bucket, path);
    if (!exists) {
      return;
    }
    await storage.remove(bucket, path);
  } catch (error) {
    console.warn("cleanup failed", { bucket, path, error });
  }
}

async function runAnalyze(job: QueueJob, deps: RunStageDeps): Promise<void> {
  const analysisObjectPath = deps.analysisPath(job.orgId, job.callId, job.id);
  const analysisExists = await deps.storage.exists(deps.bucket, analysisObjectPath);
  if (analysisExists) {
    if (deps.enqueueJob) {
      await deps.enqueueJob({
        orgId: job.orgId,
        callId: job.callId,
        stage: "persist_analysis",
        payload: {
          analysisObjectPath,
          transcriptObjectPath: job.payload?.transcriptObjectPath,
          transcriptFileName: job.payload?.transcriptFileName,
          salesRepName: job.payload?.salesRepName ?? job.payload?.sales_rep_name,
          source: job.payload?.source,
        },
        maxAttempts: 5,
      });
    }
    return;
  }

  const transcriptObjectPath = String(job.payload?.transcriptObjectPath ?? "");
  if (!transcriptObjectPath) {
    throw new Error("missing payload.transcriptObjectPath for analyze");
  }

  const transcriptFilename =
    (job.payload?.transcriptFileName as string | undefined) ??
    transcriptObjectPath.split("/").pop() ??
    `${job.callId}.json`;
  const salesRepName =
    (job.payload?.salesRepName as string | undefined) ??
    (job.payload?.sales_rep_name as string | undefined) ??
    "Неизвестно";

  const tempDir = await fs.mkdtemp(join(tmpdir(), "call-"));
  const transcriptFile = join(tempDir, `${job.callId}.json`);
  const analysisFile = join(tempDir, `${job.callId}.analysis.json`);

  try {
    await deps.storage.download(deps.bucket, transcriptObjectPath, transcriptFile);
    const transcriptJson = await fs.readFile(transcriptFile, "utf8");
    const { systemPrompt, userPromptTemplate } = await loadAnalysisPrompt();
    const userPrompt = renderUserPrompt(userPromptTemplate, {
      transcriptFilename,
      salesRepName,
      transcriptText: transcriptJson,
      callId: job.callId,
      source: (job.payload?.source as string | undefined) ?? undefined,
    });

    const result = await analyzeTranscript({ systemPrompt, userPrompt });
    await fs.writeFile(analysisFile, JSON.stringify(result.outputJson, null, 2));

    await deps.storage.upload(
      deps.bucket,
      analysisObjectPath,
      analysisFile,
      "application/json",
    );

    if (deps.onAnalysisArtifact) {
      const stats = await fs.stat(analysisFile);
      await deps.onAnalysisArtifact({
        orgId: job.orgId,
        callId: job.callId,
        storagePath: analysisObjectPath,
        contentType: "application/json",
        sizeBytes: stats.size,
      });
    }

    if (!deps.enqueueJob) {
      throw new Error("enqueueJob is required for analyze");
    }
    await deps.enqueueJob({
      orgId: job.orgId,
      callId: job.callId,
      stage: "persist_analysis",
      payload: {
        analysisObjectPath,
        transcriptObjectPath,
        transcriptFileName: transcriptFilename,
        salesRepName,
        source: (job.payload?.source as string | undefined) ?? undefined,
      },
      maxAttempts: 5,
    });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function toSeconds(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  if (value.endsWith("s")) {
    const trimmed = value.slice(0, -1);
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function runPersistAnalysis(job: QueueJob, deps: RunStageDeps): Promise<void> {
  const analysisObjectPath = String(job.payload?.analysisObjectPath ?? "");
  if (!analysisObjectPath) {
    throw new Error("missing payload.analysisObjectPath for persist_analysis");
  }
  if (!deps.db) {
    throw new Error("db is required for persist_analysis");
  }

  await persistAnalysis({
    job,
    db: deps.db,
    storage: deps.storage,
    bucket: deps.bucket,
    analysisObjectPath,
  });
}
