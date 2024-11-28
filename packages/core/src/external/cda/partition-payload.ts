import { toArray } from "@metriport/shared";
import { createXMLParser } from "@metriport/shared/common/xml-parser";
import { sizeInBytes } from "../../util/string";
import { XMLBuilder } from "fast-xml-parser";

const MAX_CHUNK_SIZE = 3_000_000; // 10MB in bytes

export function partitionPayload(payloadRaw: string): string[] {
  console.log("sizeInBytes(payloadRaw)", sizeInBytes(payloadRaw));
  if (sizeInBytes(payloadRaw) < MAX_CHUNK_SIZE) return [payloadRaw];

  const parser = createXMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "_",
    removeNSPrefix: true,
  });
  const json = parser.parse(payloadRaw);

  console.log("TOO BIG");
  if (!json.ClinicalDocument?.component?.structuredBody?.component) {
    return [payloadRaw];
  }
  console.log("GOT HERE");

  const components = toArray(json.ClinicalDocument?.component?.structuredBody?.component);

  const chunks: string[] = [];
  let currentComponents: string[] = [];
  let currentSize = 0;

  const builder = new XMLBuilder({
    format: false,
    ignoreAttributes: false,
    attributeNamePrefix: "_",
    suppressEmptyNode: true,
    suppressBooleanAttributes: false,
  });

  function createChunk(comps: string[]) {
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

  for (const component of components) {
    const componentSize = sizeInBytes(JSON.stringify(component));

    if (currentSize + componentSize > MAX_CHUNK_SIZE && currentComponents.length > 0) {
      chunks.push(createChunk(currentComponents));
      currentComponents = [];
      currentSize = 0;
    }

    if (componentSize > MAX_CHUNK_SIZE) {
      if (currentComponents.length > 0) {
        chunks.push(createChunk(currentComponents));
        currentComponents = [];
        currentSize = 0;
      }
      chunks.push(createChunk([component]));
      continue;
    }

    currentComponents.push(component);
    currentSize += componentSize;
  }

  if (currentComponents.length > 0) {
    chunks.push(createChunk(currentComponents));
  }

  return chunks.length > 0 ? chunks : [payloadRaw];
}
