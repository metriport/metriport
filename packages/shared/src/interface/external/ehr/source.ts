import { BadRequestError } from "../../../error/bad-request";

export enum EhrSources {
  athena = "athenahealth",
  elation = "elation",
  canvas = "canvas",
  healthie = "healthie",
  eclinicalworks = "eclinicalworks",
  salesforce = "salesforce",
  epic = "epic",
}
export const ehrSources = [...Object.values(EhrSources)] as const;
export type EhrSource = (typeof ehrSources)[number];
export function isEhrSource(source: string): source is EhrSource {
  return ehrSources.includes(source as EhrSource);
}

export function parseEhrSourceOrFail(source: string | undefined): EhrSource | undefined {
  if (!source) return undefined;
  if (!isEhrSource(source)) {
    throw new BadRequestError(
      `Invalid source: ${source}. Must be one of: ${ehrSources.join(", ")}`
    );
  }
  return source as EhrSource;
}

export const clientSourceSuffix = "-client";
export const webhookSourceSuffix = "-webhook";

export function removeClientSource(source: string): EhrSource {
  return source.replace(clientSourceSuffix, "") as EhrSource;
}

export function removeWebhookSource(source: string): EhrSource {
  return source.replace(webhookSourceSuffix, "") as EhrSource;
}
