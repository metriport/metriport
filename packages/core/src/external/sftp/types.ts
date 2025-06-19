import type SshSftpClient from "ssh2-sftp-client";

export interface SftpClientImpl {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  read(remotePath: string, options?: SftpReadOptions): Promise<Buffer>;
  write(remotePath: string, content: Buffer, options?: SftpWriteOptions): Promise<void>;
  list(remotePath: string, filter?: SftpListFilterFunction): Promise<string[]>;
  exists(remotePath: string): Promise<boolean>;
}

export interface SftpReplica {
  getReplicaPath(remotePath: string): string;
  listFileNames(replicaPath: string): Promise<string[]>;
  listFileNamesWithPrefix(replicaPath: string, prefix: string): Promise<string[]>;
  readFile(replicaPath: string): Promise<Buffer>;
  writeFile(replicaPath: string, content: Buffer): Promise<void>;
  hasFile(replicaPath: string): Promise<boolean>;
}

export interface SftpReadOptions {
  decompress?: boolean;
  overrideReplica?: boolean; // default true
}

export interface SftpWriteOptions {
  compress?: boolean;
}

export interface SftpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  privateKey?: string;
  logLevel?: "info" | "debug" | "none"; // default "none"
}

export interface SftpFile {
  fileName: string;
  content: Buffer;
}

export type SftpListFilterFunction = SshSftpClient.ListFilterFunction;
