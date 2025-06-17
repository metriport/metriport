export interface SftpActionHandler {
  executeAction<A extends SftpAction>(
    action: A
  ): Promise<{ result?: SftpActionResult<A>; error?: Error }>;
}

export type SftpAction =
  | SftpConnectAction
  | SftpReadAction
  | SftpWriteAction
  | SftpListAction
  | SftpExistsAction;

export interface SftpBaseAction {
  type: "connect" | "read" | "write" | "list" | "exists";
}

export type SftpActionResult<A extends SftpBaseAction> = SftpBaseAction extends A
  ? unknown
  : A extends { type: "connect" }
  ? boolean
  : A extends { type: "read" }
  ? Buffer
  : A extends { type: "write" }
  ? undefined
  : A extends { type: "list" }
  ? string[]
  : A extends { type: "exists" }
  ? boolean
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
  content: string; // base64 encoded Buffer
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
