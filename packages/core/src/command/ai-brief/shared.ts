import { Binary, Bundle } from "@medplum/fhirtypes";
import { buildDayjs } from "@metriport/shared/common/date";
import { stringToBase64, base64ToString } from "../../util/base64";
import { isBinary, findResourceInBundle } from "../../external/fhir/shared";
import { uuidv7 } from "../../util/uuid-v7";

export function generateAiBriefFhirResource(content: string | undefined): Binary | undefined {
  if (!content) return undefined;

  const encodedContent = stringToBase64(content);

  return {
    resourceType: "Binary",
    id: uuidv7(),
    meta: {
      versionId: "1",
      lastUpdated: buildDayjs().toISOString(),
      source: "metriport:ai-generated-brief",
    },
    contentType: "text/plain",
    data: encodedContent,
  };
}

export function getAiBriefContentFromBundle(bundle: Bundle): string | undefined {
  const binaryResource = findResourceInBundle(bundle, "Binary");

  console.log("TEST BINARY", binaryResource);

  if (!isBinary(binaryResource)) return undefined;

  console.log("TEST BINARY DATA", binaryResource.data);

  if (!binaryResource.data) return undefined;

  console.log("TEST BINARY DATA", binaryResource.data);

  return base64ToString(binaryResource.data);
}
