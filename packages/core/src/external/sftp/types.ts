import type SshSftpClient from "ssh2-sftp-client";

export interface SftpClientImpl {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  read(remotePath: string): Promise<Buffer>;
  write(remotePath: string, content: Buffer): Promise<void>;
  list(remotePath: string): Promise<string[]>;
  exists(remotePath: string): Promise<boolean>;
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

export type SftpAction =
  | SftpReadAction
  | SftpWriteAction
  | SftpListAction
  | SftpExistsAction
  | SftpCloneAction;

export interface SftpBaseAction {
  type: "read" | "write" | "list" | "exists" | "clone";
}

export type SftpActionResult<A extends SftpBaseAction> = SftpBaseAction extends A
  ? unknown
  : A extends { type: "read" }
  ? Buffer
  : A extends { type: "write" }
  ? void
  : A extends { type: "list" }
  ? string[]
  : A extends { type: "exists" }
  ? boolean
  : A extends { type: "clone" }
  ? SftpFile[]
  : never;

export interface SftpReadAction extends SftpBaseAction {
  type: "read";
  remotePath: string;
  decompress?: boolean;
  replicaPath?: string;
}

export interface SftpWriteAction extends SftpBaseAction {
  type: "write";
  remotePath: string;
  content: Buffer;
  compress?: boolean;
}

export interface SftpListAction extends SftpBaseAction {
  type: "list";
  remotePath: string;
  prefix?: string;
  contains?: string;
}

export interface SftpExistsAction extends SftpBaseAction {
  type: "exists";
  remotePath: string;
}

export interface SftpCloneAction extends SftpBaseAction {
  type: "clone";
  remotePath: string;
  replicaPath: string;
}

export interface SftpReplica {
  listFileNames(replicaPath: string): Promise<string[]>;
  readFile(replicaPath: string): Promise<Buffer>;
  readFileMetadata<M extends object>(replicaPath: string): Promise<M | undefined>;
  writeFile<M extends object>(replicaPath: string, content: Buffer, metadata?: M): Promise<void>;

  // writeOutgoingFile<M extends object>(fileName: string, content: Buffer, metadata?: M): Promise<void>;
  // readIncomingFile(fileName: string): Promise<Buffer | undefined>;
  hasFile(filePath: string): Promise<boolean>;
}
