import fs from "fs";
import path from "path";
import { Replica } from "./types";

export abstract class LocalReplica implements Replica {
  private readonly encoding = "ascii";

  constructor(private readonly localPath: string) {}

  abstract listDirectoryNames(): string[];

  async listFileNames(directoryName: string): Promise<string[]> {
    return fs.readdirSync(path.join(this.localPath, directoryName));
  }

  async readFile(directoryName: string, fileName: string): Promise<string> {
    return fs.readFileSync(path.join(this.localPath, directoryName, fileName), this.encoding);
  }

  async readFileMetadata<M extends object>(directoryName: string, fileName: string): Promise<M> {
    const jsonName = `${fileName}.metadata.json`;
    return JSON.parse(
      fs.readFileSync(path.join(this.localPath, directoryName, jsonName), "utf-8")
    ) as M;
  }

  async writeFile<M extends object>(
    directoryName: string,
    fileName: string,
    content: string,
    metadata?: M
  ): Promise<void> {
    fs.writeFileSync(path.join(this.localPath, directoryName, fileName), content, this.encoding);
    if (metadata) {
      const jsonName = `${fileName}.metadata.json`;
      fs.writeFileSync(
        path.join(this.localPath, directoryName, jsonName),
        JSON.stringify(metadata),
        "utf-8"
      );
    }
  }

  async hasFile(directoryName: string, fileName: string): Promise<boolean> {
    return fs.existsSync(path.join(this.localPath, directoryName, fileName));
  }
}
