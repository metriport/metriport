import crypto from "crypto";
import { out } from "../../util/log";
import {
  ComprehendMedicalClient,
  DetectEntitiesV2Command,
  DetectEntitiesV2CommandOutput,
  InferRxNormCommand,
  InferRxNormCommandOutput,
  InferICD10CMCommand,
  InferICD10CMCommandOutput,
  InferSNOMEDCTCommand,
  InferSNOMEDCTCommandOutput,
} from "@aws-sdk/client-comprehendmedical";
import { Config } from "../../util/config";

type LogLevel = "debug" | "info" | "none";

export class ComprehendClient {
  private comprehend: ComprehendMedicalClient;
  private readonly logger: ReturnType<typeof out>;

  constructor({
    region = Config.getAWSComprehendRegion(),
    logLevel = "info",
  }: { region?: string; logLevel?: LogLevel } = {}) {
    this.comprehend = new ComprehendMedicalClient({
      region,
    });
    this.logger = buildLogger(logLevel);
  }

  async inferRxNorm(text: string): Promise<InferRxNormCommandOutput> {
    this.debug("Inferring RxNorm codes", text);
    const command = new InferRxNormCommand({
      Text: text,
    });
    const startTime = Date.now();
    const response = await this.comprehend.send(command);
    this.log(`Completed RxNorm inference in ${Date.now() - startTime}ms`);
    return response;
  }

  async inferICD10CM(text: string): Promise<InferICD10CMCommandOutput> {
    this.debug("Inferring ICD-10-CM codes", text);
    const startTime = Date.now();
    const command = new InferICD10CMCommand({
      Text: text,
    });
    const response = await this.comprehend.send(command);
    this.log(`Completed ICD-10-CM inference in ${Date.now() - startTime}ms`);
    return response;
  }

  async inferSNOMEDCT(text: string): Promise<InferSNOMEDCTCommandOutput> {
    this.debug("Inferring SNOMED CT codes", text);
    const startTime = Date.now();
    const command = new InferSNOMEDCTCommand({
      Text: text,
    });
    const response = await this.comprehend.send(command);
    this.log(`Completed SNOMED CT inference in ${Date.now() - startTime}ms`);
    return response;
  }

  async detectEntities(text: string): Promise<DetectEntitiesV2CommandOutput> {
    this.debug("Detecting entities", text);
    const startTime = Date.now();
    const command = new DetectEntitiesV2Command({
      Text: text,
    });
    const response = await this.comprehend.send(command);
    this.log(`Completed entity detection in ${Date.now() - startTime}ms`);
    return response;
  }

  getCacheKey(text: string): string {
    return crypto.createHash("sha256").update(text).digest("hex");
  }

  private log(message: string, ...optionalParams: unknown[]): void {
    this.logger.log(message, ...optionalParams);
  }

  private debug(message: string, ...optionalParams: unknown[]): void {
    this.logger.debug(message, ...optionalParams);
  }
}

function buildLogger(logLevel: LogLevel): ReturnType<typeof out> {
  if (logLevel === "none") {
    return {
      log: () => {}, //eslint-disable-line @typescript-eslint/no-empty-function
      debug: () => {}, //eslint-disable-line @typescript-eslint/no-empty-function
    };
  }
  if (logLevel === "info") {
    return {
      debug: () => {}, //eslint-disable-line @typescript-eslint/no-empty-function
      log: out("comprehend").log,
    };
  }
  return out("comprehend");
}
