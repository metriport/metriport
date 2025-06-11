import { Stack } from "aws-cdk-lib";
import { Code, ILayerVersion, LayerVersion, Runtime } from "aws-cdk-lib/aws-lambda";

export const layers = [
  "shared",
  "chromium",
  "dig",
  "wkHtmlToPdf",
  "playwright",
  "puppeteer",
  "langchain",
  "saxon",
] as const;
export type LambdaLayer = (typeof layers)[number];

export type LambdaLayers = Record<LambdaLayer, ILayerVersion>;

export function setupLambdasLayers(stack: Stack, prefixStackName = false): LambdaLayers {
  const prefix = prefixStackName ? `${stack.stackName}-` : "";
  return {
    shared: new LayerVersion(stack, `${prefix}LambdaNodeModules`, {
      layerVersionName: `${prefix}LambdaNodeModules`,
      code: Code.fromAsset("../lambdas/layers/shared/shared-layer.zip"),
    }),
    /** @deprecated use wkHtmlToPdf instead */
    chromium: new LayerVersion(stack, `${prefix}Chromium-layer`, {
      layerVersionName: `${prefix}Chromium-layer`,
      compatibleRuntimes: [Runtime.NODEJS_16_X],
      code: Code.fromAsset("../lambdas/layers/chromium"),
      description: "Adds chromium to the lambda",
    }),
    /** @deprecated use wkHtmlToPdf instead */
    dig: new LayerVersion(stack, `${prefix}Dig-layer`, {
      layerVersionName: `${prefix}Dig-layer`,
      compatibleRuntimes: [Runtime.NODEJS_16_X],
      code: Code.fromAsset("../lambdas/layers/dig-layer"),
      description: "Adds dig to the lambdas",
    }),
    wkHtmlToPdf: new LayerVersion(stack, `${prefix}WkHtmlToPdf-layer`, {
      layerVersionName: `${prefix}WkHtmlToPdf-layer`,
      code: Code.fromAsset("../lambdas/layers/wkhtmltopdf-0.12.6-4"),
    }),
    playwright: new LayerVersion(stack, `${prefix}PlaywrightLayer`, {
      layerVersionName: `${prefix}PlaywrightLayer`,
      code: Code.fromAsset("../lambdas/layers/playwright/dist/playwright-layer.zip"),
    }),
    puppeteer: new LayerVersion(stack, `${prefix}PuppeteerLayer`, {
      layerVersionName: `${prefix}PuppeteerLayer`,
      code: Code.fromAsset("../lambdas/layers/puppeteer/dist/puppeteer-layer.zip"),
    }),
    langchain: new LayerVersion(stack, `${prefix}LangchainLayer`, {
      layerVersionName: `${prefix}LangchainLayer`,
      code: Code.fromAsset("../lambdas/layers/langchain/dist/langchain-layer.zip"),
    }),
    saxon: new LayerVersion(stack, `${prefix}SaxonLayer`, {
      layerVersionName: `${prefix}SaxonLayer`,
      code: Code.fromAsset("../lambdas/layers/saxon/dist/saxon-layer.zip"),
    }),
  };
}
