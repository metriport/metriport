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

export interface SftpReplicaActionOptions {
  connect?: boolean; // default true
  disconnect?: boolean; // default true
  overwrite?: boolean; // default false
}

export interface SftpReadOptions {
  decompress?: boolean;
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

export type SftpAction =
  | SftpConnectAction
  | SftpReadAction
  | SftpWriteAction
  | SftpListAction
  | SftpExistsAction
  | SftpCloneAction;

export interface SftpBaseAction {
  type: "connect" | "read" | "write" | "list" | "exists" | "clone";
}

export type SftpActionResult<A extends SftpBaseAction> = SftpBaseAction extends A
  ? unknown
  : A extends { type: "connect" }
  ? boolean
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

export interface SftpConnectAction extends SftpBaseAction {
  type: "connect";
}

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
