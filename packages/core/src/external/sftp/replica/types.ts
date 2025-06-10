export interface Replica {
  listDirectoryNames(): string[];
  listFileNames(directoryName: string): Promise<string[]>;
  readFile(directoryName: string, fileName: string): Promise<string>;
  readFileMetadata<M extends object>(
    directoryName: string,
    fileName: string
  ): Promise<M | undefined>;
  writeFile<M extends object>(
    directoryName: string,
    fileName: string,
    content: string,
    metadata?: M
  ): Promise<void>;
  hasFile(directoryName: string, fileName: string): Promise<boolean>;
}
