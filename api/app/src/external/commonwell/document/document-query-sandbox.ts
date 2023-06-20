import { DocumentReference } from "@medplum/fhirtypes";
import {
  MAPIWebhookStatus,
  MAPIWebhookType,
  processPatientDocumentRequest,
} from "../../../command/webhook/medical";
import { Facility } from "../../../models/medical/facility";
import { Organization } from "../../../models/medical/organization";
import { Patient } from "../../../models/medical/patient";
import { toDTO } from "../../../routes/medical/dtos/documentDTO";
import { encodeExternalId } from "../../../shared/external";
import { getSandboxSeedData } from "../../../shared/sandbox/sandbox-seed-data";
import { Util } from "../../../shared/util";
import { convertCDAToFHIR } from "../../fhir-converter/converter";
import { upsertDocumentToFHIRServer } from "../../fhir/document/save-document-reference";
import { updateDocQuery } from "../../../command/medical/document/document-query";
import { isConvertible } from "../../fhir-converter/converter";
import { sandboxSleepTime } from "./shared";

export async function sandboxGetDocRefsAndUpsert({
  organization,
  patient,
}: {
  organization: Organization;
  patient: Patient;
  facility: Facility;
  override?: boolean;
}): Promise<DocumentReference[]> {
  const { log } = Util.out(`sandboxGetDocRefsAndUpsert - M patient ${patient.id}`);

  // Mimic Prod by waiting for docs to download
  await Util.sleep(Math.random() * sandboxSleepTime);

  const patientData = getSandboxSeedData(patient.data.firstName);
  if (!patientData) return [];

  const entries = patientData.docRefs;
  log(`Got ${entries.length} doc refs`);

  let convertibleDocCount = patientData.docRefs
    .map(entry => {
      return {
        content: { mimeType: entry.docRef.content?.[0]?.attachment?.contentType },
      };
    })
    .filter(isConvertible).length;

  for (const [index, entry] of entries.entries()) {
    let prevDocId;
    try {
      prevDocId = entry.docRef.id;
      // TODO find a better way to define a unique doc ID
      entry.docRef.id = encodeExternalId(patient.id + "_" + index);
      const fhirDocId = entry.docRef.id;

      const conversionRequested = await convertCDAToFHIR({
        patient,
        document: {
          id: fhirDocId,
          content: { mimeType: entry.docRef.content?.[0]?.attachment?.contentType },
        },
        s3FileName: entry.s3Info.key,
        s3BucketName: entry.s3Info.bucket,
      });

      if (!conversionRequested) convertibleDocCount = convertibleDocCount - 1;

      const contained = entry.docRef.contained ?? [];
      const containsPatient = contained.filter(c => c.resourceType === "Patient").length > 0;
      if (!containsPatient) {
        contained.push({
          resourceType: "Patient",
          id: patient.id,
        });
      }
      entry.docRef.subject = {
        type: "Patient",
        reference: `Patient/${patient.id}`,
      };
      entry.docRef.contained = contained;
      await upsertDocumentToFHIRServer(patient.cxId, entry.docRef);
    } catch (err) {
      log(
        `Error w/ file docId ${entry.docRef.id}, prevDocId ${prevDocId}: ${JSON.stringify(
          err,
          null,
          2
        )}`
      );
    }
  }

  await updateDocQuery({
    patient: { id: patient.id, cxId: patient.cxId },
    downloadProgress: {
      total: entries.length,
      status: "completed",
    },
    ...(convertibleDocCount > 0
      ? {
          convertProgress: {
            status: "processing",
            total: convertibleDocCount,
          },
        }
      : undefined),
  });

  const result = entries.map(d => d.docRef);

  processPatientDocumentRequest(
    organization.cxId,
    patient.id,
    MAPIWebhookType.documentDownload,
    MAPIWebhookStatus.completed,
    toDTO(result)
  );

  return result;
}
