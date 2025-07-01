import { ExtractBundleCommand } from "./extract-bundle";
import { ExtractionJob } from "../../types";
import { ComprehendClient } from "../../client";

export class ExtractBundleDirectCommand implements ExtractBundleCommand {
  constructor(private readonly client: ComprehendClient = new ComprehendClient()) {}

  async extractFhir(job: ExtractionJob) {
    console.log("Extracting", job);
  }
}
