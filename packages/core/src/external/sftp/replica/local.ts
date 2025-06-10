import fs from "fs";
import path from "path";
import { Replica } from "./types";

export class LocalReplica implements Replica {
  constructor(private readonly localPath: string) {}

  async listFileNames(directoryName: string): Promise<string[]> {
    return fs.readdirSync(path.join(this.localPath, directoryName));
  }

  async readFile(filePath: string): Promise<Buffer> {
    return fs.readFileSync(path.join(this.localPath, filePath));
  }

  async readFileMetadata<M extends object>(filePath: string): Promise<M | undefined> {
    const jsonName = `${filePath}.metadata.json`;
    return JSON.parse(fs.readFileSync(path.join(this.localPath, jsonName), "utf-8")) as M;
  }

  async writeFile<M extends object>(
    filePath: string,
    content: Buffer,
    metadata?: M
  ): Promise<void> {
    fs.writeFileSync(path.join(this.localPath, filePath), content);
    if (metadata) {
      const jsonName = `${filePath}.metadata.json`;
      fs.writeFileSync(path.join(this.localPath, jsonName), JSON.stringify(metadata), "utf-8");
    }
  }

  async hasFile(filePath: string): Promise<boolean> {
    return fs.existsSync(path.join(this.localPath, filePath));
  }
}
