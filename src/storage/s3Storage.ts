import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { StorageClient } from "./types";

export interface S3StorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export class S3Storage implements StorageClient {
  private client: S3Client;

  constructor(config: S3StorageConfig) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  async download(bucket: string, path: string, destinationPath: string): Promise<void> {
    await fs.mkdir(dirname(destinationPath), { recursive: true });
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: bucket, Key: path }),
    );

    if (!result.Body) {
      throw new Error("empty object body");
    }

    const chunks: Buffer[] = [];
    for await (const chunk of result.Body as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }
    await fs.writeFile(destinationPath, Buffer.concat(chunks));
  }

  async upload(
    bucket: string,
    path: string,
    filePath: string,
    contentType?: string,
  ): Promise<void> {
    const body = createReadStream(filePath);
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: path,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async remove(bucket: string, path: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: path }));
  }

  async exists(bucket: string, path: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: path }));
      return true;
    } catch (error) {
      const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }
}
