import fs from "fs";
import path from "path";
import { SftpReplica } from "../types";

export class LocalReplica implements SftpReplica {
  constructor(private readonly localPath: string) {}

  getReplicaPath(remotePath: string): string {
    return remotePath.replace(/^\//, "");
  }

  async listFileNames(replicaDirectoryName: string): Promise<string[]> {
    return fs.readdirSync(path.join(this.localPath, replicaDirectoryName));
  }

  async listFileNamesWithPrefix(replicaDirectoryName: string, prefix: string): Promise<string[]> {
    const fileNames = await this.listFileNames(replicaDirectoryName);
    return fileNames.filter(fileName => fileName.startsWith(prefix));
  }

  async readFile(replicaPath: string): Promise<Buffer> {
    return fs.readFileSync(path.join(this.localPath, replicaPath));
  }

  async writeFile(replicaPath: string, content: Buffer): Promise<void> {
    fs.writeFileSync(path.join(this.localPath, replicaPath), content);
  }

  async hasFile(replicaPath: string): Promise<boolean> {
    return fs.existsSync(path.join(this.localPath, replicaPath));
  }
}
