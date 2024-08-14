import { ExtractResource, ResourceType } from "@medplum/fhirtypes";

export const MAX_IDS_PER_REQUEST = 150;

export const getAllPages = async <K extends ExtractResource<ResourceType>>(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  searchFunction: <W extends K>() => AsyncGenerator<K[]>
) => {
  const pages: K[] = [];
  for await (const page of searchFunction<K>()) {
    pages.push(...page);
  }
  return pages;
};
