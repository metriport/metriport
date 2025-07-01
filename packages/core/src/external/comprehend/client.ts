import {
  ComprehendMedicalClient,
  DetectEntitiesV2Command,
  DetectEntitiesV2CommandOutput,
} from "@aws-sdk/client-comprehendmedical";
import { Config } from "../../util/config";
import { buildEntityGraph } from "./entity-graph";
import { EntityGraph } from "./types";

export class ComprehendClient {
  private client: ComprehendMedicalClient;

  constructor(region: string = Config.getAwsComprehendRegion()) {
    this.client = new ComprehendMedicalClient({
      region,
    });
  }

  async buildEntityGraph(text: string): Promise<EntityGraph | undefined> {
    const { Entities } = await this.detectEntities(text);
    const entityGraph = buildEntityGraph(Entities ?? []);
    return entityGraph;
  }

  async detectEntities(text: string): Promise<DetectEntitiesV2CommandOutput> {
    const command = new DetectEntitiesV2Command({
      Text: text,
    });
    const startTime = Date.now();
    const response = await this.client.send(command);
    const endTime = Date.now();
    console.log(`Comprehend detected entities in ${endTime - startTime}ms`);
    return response;
  }
}
