import {
  ComprehendMedicalClient,
  DetectEntitiesV2Command,
  DetectEntitiesV2CommandOutput,
} from "@aws-sdk/client-comprehendmedical";
import { Config } from "../../util/config";

export class ComprehendClient {
  private comprehend: ComprehendMedicalClient;

  constructor({ region = Config.getComprehendRegion() }: { region?: string } = {}) {
    this.comprehend = new ComprehendMedicalClient({
      region,
    });
  }

  async detectEntities(text: string): Promise<DetectEntitiesV2CommandOutput> {
    console.debug("Detecting entities", text);
    const startTime = Date.now();
    const command = new DetectEntitiesV2Command({
      Text: text,
    });
    const response = await this.comprehend.send(command);
    console.log(`Completed entity detection in ${Date.now() - startTime}ms`);
    return response;
  }
}
