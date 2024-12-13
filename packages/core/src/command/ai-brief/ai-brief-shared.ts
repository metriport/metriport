import { Binary, Bundle } from "@medplum/fhirtypes";
import { Buffer } from "buffer";
import dayjs from "dayjs";
import { uuidv7 } from "../../util/uuid-v7";

export async function generateAiBriefFhirResource(
  content: string | undefined
): Promise<Binary | undefined> {
  if (!content) return undefined;

  const encodedContent = Buffer.from(content).toString("base64");

  return {
    resourceType: "Binary",
    id: uuidv7(),
    meta: {
      versionId: "1",
      lastUpdated: dayjs().toISOString(),
      source: "ai-generated-brief",
    },
    contentType: "text/plain",
    data: encodedContent,
  };
}

export function getAiBriefContentFromBundle(bundle: Bundle): string | undefined {
  const binaryResource = bundle.entry?.find(entry => entry.resource?.resourceType === "Binary") as
    | Binary
    | undefined;

  if (!binaryResource || !binaryResource.data) return undefined;

  return Buffer.from(binaryResource.data).toString("base64");
}
