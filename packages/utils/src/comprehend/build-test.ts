import { ComprehendClient } from "../client";

export async function buildRxNormArtifact(name: string, inputText: string) {
  const client = new ComprehendClient();
  const response = await client.inferRxNorm(inputText);
  const entities = response.Entities ?? [];
  const entity = entities.find(entity => entity.Text === inputText);
  return entity;
}
