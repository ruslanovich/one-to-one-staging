import { JobQueue, JobStage } from "../queue/types";

export interface EnqueueInput {
  orgId: string;
  callId: string;
  fileName: string;
}

const stages: JobStage[] = ["extract_audio", "transcribe_start"];

export async function enqueueProcessingStages(
  queue: JobQueue,
  input: EnqueueInput,
): Promise<void> {
  for (const stage of stages) {
    await queue.enqueue({
      orgId: input.orgId,
      callId: input.callId,
      stage,
      payload: { fileName: input.fileName },
      maxAttempts: 5,
    });
  }
}
