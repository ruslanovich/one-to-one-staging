export type JobStage = "extract_audio" | "transcribe_start" | "transcribe_poll" | "analyze";
export type JobStatus = "queued" | "processing" | "done" | "failed";

export interface QueueJob {
  id: string;
  orgId: string;
  callId: string;
  stage: JobStage;
  status: JobStatus;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
}

export interface JobQueue {
  enqueue(job: Omit<QueueJob, "id" | "status" | "attempts">): Promise<void>;
  enqueueAt?(
    job: Omit<QueueJob, "id" | "status" | "attempts">,
    availableAt: Date,
  ): Promise<void>;
  claim(workerId: string): Promise<QueueJob | null>;
  complete(jobId: string): Promise<void>;
  fail(jobId: string, error: string, backoffSeconds: number): Promise<void>;
}
