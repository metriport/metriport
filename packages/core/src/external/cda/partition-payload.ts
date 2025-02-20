import { toArray } from "@metriport/shared";
import { createXMLParser } from "@metriport/shared/common/xml-parser";
import { sizeInBytes } from "../../util/string";
import { XMLBuilder } from "fast-xml-parser";

export const MAX_CHUNK_SIZE_IN_BYTES = 5_000_000;
const builder = new XMLBuilder({
  format: false,
  ignoreAttributes: false,
  attributeNamePrefix: "_",
  suppressEmptyNode: true,
  suppressBooleanAttributes: false,
});

export function partitionPayload(
  payloadRaw: string,
  maxChunkSize = MAX_CHUNK_SIZE_IN_BYTES
): string[] {
  if (sizeInBytes(payloadRaw) < maxChunkSize) return [payloadRaw];

  const parser = createXMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "_",
    removeNSPrefix: true,
  });
  const json = parser.parse(payloadRaw);

  if (!json.ClinicalDocument?.component?.structuredBody?.component) {
    return [payloadRaw];
  }

  const chunks: string[] = [];

  let groupedComponents: string[] = [];
  let groupedSize = 0;
  const components = toArray(json.ClinicalDocument?.component?.structuredBody?.component);
  for (const currentComponent of components) {
    const currentSize = sizeInBytes(JSON.stringify(currentComponent));

    if (groupedSize + currentSize > maxChunkSize) {
      if (groupedComponents.length > 0) {
        chunks.push(createChunk(json, groupedComponents));
        groupedComponents = [currentComponent];
        groupedSize = currentSize;
      } else {
        // currentComponent size is larger than max chunk size
        chunks.push(createChunk(json, currentComponent));
        groupedComponents = [];
        groupedSize = 0;
      }
      continue;
    }

    groupedComponents.push(currentComponent);
    groupedSize += currentSize;
  }

  if (groupedComponents.length > 0) {
    chunks.push(createChunk(json, groupedComponents));
  }

  return chunks.length > 0 ? chunks : [payloadRaw];
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
function createChunk(json: any, comps: string[]) {
  const chunk = {
    ...json,
    ClinicalDocument: {
      ...json.ClinicalDocument,
      component: {
        ...json.ClinicalDocument.component,
        structuredBody: {
          ...json.ClinicalDocument.component.structuredBody,
          component: comps,
        },
      },
    },
  };
  return builder.build(chunk);
}
