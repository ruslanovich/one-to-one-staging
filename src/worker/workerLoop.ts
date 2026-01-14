import { JobQueue } from "../queue/types";
import { runStage, RunStageDeps } from "./runStage";

export async function workerLoop(
  queue: JobQueue,
  deps: RunStageDeps,
  workerId: string,
): Promise<void> {
  while (true) {
    const job = await queue.claim(workerId);
    if (!job) {
      await sleep(1000);
      continue;
    }
    try {
      await runStage(job, deps);
      await queue.complete(job.id);
    } catch (error) {
      const attempts = job.attempts ?? 0;
      const backoffSeconds = Math.min(600, 30 * Math.pow(2, attempts));
      const message = error instanceof Error ? error.message : String(error);
      await queue.fail(job.id, message, backoffSeconds);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
