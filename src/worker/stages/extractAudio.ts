import { spawn } from "node:child_process";

export interface ExtractAudioInput {
  inputPath: string;
  outputPath: string;
  ffmpegPath?: string;
}

export async function extractAudio({
  inputPath,
  outputPath,
  ffmpegPath = "ffmpeg",
}: ExtractAudioInput): Promise<void> {
  const args = [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-acodec",
    "libmp3lame",
    "-ar",
    "16000",
    "-ac",
    "1",
    outputPath,
  ];

  await runCommand(ffmpegPath, args);
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 8000) {
        stderr = stderr.slice(-8000);
      }
    });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg failed with code ${code}: ${stderr.trim()}`));
    });
  });
}
