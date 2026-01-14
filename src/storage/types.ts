export interface StorageClient {
  download(bucket: string, path: string, destinationPath: string): Promise<void>;
  upload(bucket: string, path: string, filePath: string, contentType?: string): Promise<void>;
  remove(bucket: string, path: string): Promise<void>;
  exists(bucket: string, path: string): Promise<boolean>;
}
