import {
  ComprehendMedicalClient,
  DetectEntitiesV2Command,
  DetectEntitiesV2CommandOutput,
  DetectPHICommand,
  DetectPHICommandOutput,
  InferRxNormCommand,
  InferRxNormCommandOutput,
  InferICD10CMCommand,
  InferICD10CMCommandOutput,
  InferSNOMEDCTCommand,
  InferSNOMEDCTCommandOutput,
} from "@aws-sdk/client-comprehendmedical";
import { Config } from "../../util/config";
import { out, LogFunction } from "../../util/log";

type LogLevel = "debug" | "info" | "none";

/**
 * Client for the AWS Comprehend Medical API.
 */
export class ComprehendClient {
  private comprehend: ComprehendMedicalClient;
  private readonly log: LogFunction;
  private readonly debug: LogFunction;

  constructor({
    region = Config.getComprehendRegion(),
    logLevel = "info",
  }: { region?: string; logLevel?: LogLevel } = {}) {
    this.comprehend = new ComprehendMedicalClient({
      region,
    });
    const { log, debug } = buildLogger(logLevel);
    this.log = log;
    this.debug = debug;
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

  async detectPHI(text: string): Promise<DetectPHICommandOutput> {
    this.debug("Detecting PHI", text);
    const startTime = Date.now();
    const command = new DetectPHICommand({ Text: text });
    const response = await this.comprehend.send(command);
    this.log(`Completed PHI detection in ${Date.now() - startTime}ms`);
    return response;
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
