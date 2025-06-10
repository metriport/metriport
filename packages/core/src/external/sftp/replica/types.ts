export interface Replica {
  listFileNames(directoryName: string): Promise<string[]>;
  readFile(filePath: string): Promise<Buffer>;
  readFileMetadata<M extends object>(filePath: string): Promise<M | undefined>;
  writeFile<M extends object>(filePath: string, content: Buffer, metadata?: M): Promise<void>;
  hasFile(filePath: string): Promise<boolean>;
}
