import { Extension } from "@medplum/fhirtypes";
import { RxNormEntity } from "@aws-sdk/client-comprehendmedical";
import { DATA_EXTRACTION_URL } from "./constants";
import { ComprehendContext } from "./types";

export function buildComprehendExtensionForEntity(
  entity: RxNormEntity,
  { originalText }: ComprehendContext
): Extension {
  const textRange = getTextRange(entity);
  const entityString = textRange
    ? originalText?.slice(textRange?.start, textRange?.end)
    : undefined;

  return {
    url: DATA_EXTRACTION_URL,
    ...(entityString ? { valueString: entityString } : undefined),
  };
}

function getTextRange(entity: RxNormEntity): { start: number; end: number } | undefined {
  let start = entity.BeginOffset;
  let end = entity.EndOffset;
  if (start == null || end == null) return undefined;

  for (const attribute of entity.Attributes ?? []) {
    if (attribute.BeginOffset != null && (start == null || attribute.BeginOffset < start)) {
      start = attribute.BeginOffset;
    }
    if (attribute.EndOffset != null && (end == null || attribute.EndOffset > end)) {
      end = attribute.EndOffset;
    }
  }
  return { start, end };
}
