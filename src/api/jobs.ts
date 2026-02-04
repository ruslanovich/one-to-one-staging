import { JobQueue } from "../queue/types";
import { inferProcessingKind } from "../shared/uploadTypes";

export interface EnqueueInput {
  orgId: string;
  callId: string;
  fileName: string;
  contentType?: string | null;
}

function buildRawObjectKey(orgId: string, callId: string, fileName: string): string {
  return `orgs/${orgId}/calls/${callId}/raw/${fileName}`;
}

export async function enqueueProcessingStages(
  queue: JobQueue,
  input: EnqueueInput,
): Promise<void> {
  const processingKind = inferProcessingKind(input.fileName);

  if (processingKind === "transcript") {
    await queue.enqueue({
      orgId: input.orgId,
      callId: input.callId,
      stage: "analyze",
      payload: {
        transcriptObjectPath: buildRawObjectKey(
          input.orgId,
          input.callId,
          input.fileName,
        ),
        transcriptFileName: input.fileName,
      },
      maxAttempts: 5,
    });
    return;
  }

  if (processingKind === "audio") {
    await queue.enqueue({
      orgId: input.orgId,
      callId: input.callId,
      stage: "extract_audio",
      payload: {
        fileName: input.fileName,
        contentType: input.contentType ?? null,
      },
      maxAttempts: 5,
    });
    return;
  }

  if (processingKind === "video") {
    throw new Error("video uploads must be extracted client-side before upload");
  }

  throw new Error(`unsupported upload file type: ${input.fileName}`);
}
