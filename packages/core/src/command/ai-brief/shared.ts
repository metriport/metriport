import { Binary, Bundle, Resource } from "@medplum/fhirtypes";
import { buildDayjs } from "@metriport/shared/common/date";
import { getPatientFromBundle } from "../../external/fhir/patient/shared";
import { isBinary } from "../../external/fhir/shared";
import { capture, out } from "../../util";
import { base64ToString, stringToBase64 } from "../../util/base64";
import { uuidv7 } from "../../util/uuid-v7";

const AI_BRIEF_SOURCE = "metriport:ai-generated-brief";

export type AiBriefControls = {
  cancelled: boolean;
};

export function generateAiBriefFhirResource(content: string): Binary {
  const encodedContent = stringToBase64(content);

  return {
    resourceType: "Binary",
    id: uuidv7(),
    meta: {
      versionId: "1",
      lastUpdated: buildDayjs().toISOString(),
      source: AI_BRIEF_SOURCE,
    },
    contentType: "text/plain",
    data: encodedContent,
  };
}

export function getAiBriefContentFromBundle(bundle: Bundle): string | undefined {
  const aiBriefResource = getAiBriefResource(bundle);
  if (!aiBriefResource?.data) return undefined;
  return base64ToString(aiBriefResource.data);
}

function getAiBriefResource(bundle: Bundle): Binary | undefined {
  const { log } = out("getAiBriefContentFromBundle");
  const aiBriefResources =
    bundle.entry?.flatMap(entry => (isAiBriefResource(entry.resource) ? entry.resource : [])) ?? [];
  if (aiBriefResources.length > 1) {
    const msg = `Found more than one AI brief resource in the consolidated bundle`;
    const patient = getPatientFromBundle(bundle, false);
    log(`${msg} - ${aiBriefResources.length} AI Briefs, patient: ${patient?.id}`);
    capture.message(msg, { extra: { aiBriefResources, patient } });
  }
  return aiBriefResources[0];
}

function isAiBriefResource(resource: Resource | undefined): resource is Binary {
  return isBinary(resource) && resource.meta?.source === AI_BRIEF_SOURCE;
}
