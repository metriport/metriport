// import { ExtractionFeatureConfig } from "../types";

export abstract class ComprehendAgentTool {
  // config: ExtractionFeatureConfig;

  abstract extract(text: string): Promise<void>;
}
