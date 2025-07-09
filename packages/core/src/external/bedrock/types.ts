export type BedrockRegion = "us-east-1" | "us-east-2" | "us-west-2";

export interface BedrockConfig {
  region: BedrockRegion;
  model: string;
}
