export enum EhrSources {
  athena = "athenahealth",
  elation = "elation",
  canvas = "canvas",
}
export const ehrSources = [...Object.values(EhrSources)] as const;
export type EhrSource = (typeof ehrSources)[number];
export function isEhrSource(source: string): source is EhrSource {
  return ehrSources.includes(source as EhrSource);
}

export const clientSourceSuffix = "-client";
export const webhookSourceSuffix = "-webhook";

export function removeClientSource(source: string): EhrSource {
  return source.replace(clientSourceSuffix, "") as EhrSource;
}

export function removeWebhookSource(source: string): EhrSource {
  return source.replace(webhookSourceSuffix, "") as EhrSource;
}
