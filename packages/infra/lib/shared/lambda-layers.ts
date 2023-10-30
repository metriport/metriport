import { Stack } from "aws-cdk-lib";
import { Code, ILayerVersion, LayerVersion, Runtime } from "aws-cdk-lib/aws-lambda";

export const layers = ["shared", "chromium", "dig", "playwright"] as const;
export type LambdaLayer = (typeof layers)[number];

export type LambdaLayers = Record<LambdaLayer, ILayerVersion>;

export function setupLambdasLayers(stack: Stack): LambdaLayers {
  return {
    shared: new LayerVersion(stack, "lambdaNodeModules", {
      code: Code.fromAsset("../lambdas/layers/shared/shared-layer.zip"),
    }),
    chromium: new LayerVersion(stack, "chromium-layer", {
      compatibleRuntimes: [Runtime.NODEJS_16_X],
      code: Code.fromAsset("../lambdas/layers/chromium"),
      description: "Adds chromium to the lambda",
    }),
    dig: new LayerVersion(stack, "dig-layer", {
      compatibleRuntimes: [Runtime.NODEJS_16_X],
      code: Code.fromAsset("../lambdas/layers/dig-layer"),
      description: "Adds dig to the lambdas",
    }),
    playwright: new LayerVersion(stack, "playwrightLayer", {
      code: Code.fromAsset("../lambdas/layers/playwright/dist/playwright-layer.zip"),
    }),
  };
}
