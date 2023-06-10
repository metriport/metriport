import { DocumentReference } from "@medplum/fhirtypes";
import { Facility } from "../../../models/medical/facility";
import { Organization } from "../../../models/medical/organization";
import { Patient } from "../../../models/medical/patient";
import { encodeExternalId } from "../../../shared/external";
import { getSandboxSeedData } from "../../../shared/sandbox/sandbox-seed-data";
import { Util } from "../../../shared/util";
import { convertCDAToFHIR } from "../../fhir-converter/converter";
import { upsertDocumentToFHIRServer } from "../../fhir/document/save-document-reference";

export async function sandboxGetDocRefsAndUpsert({
  patient,
}: {
  organization: Organization;
  patient: Patient;
  facility: Facility;
  override?: boolean;
}): Promise<DocumentReference[]> {
  const { log } = Util.out(`sandboxGetDocRefsAndUpsert - M patient ${patient.id}`);

  const patientData = getSandboxSeedData(patient.data.firstName);
  if (!patientData) return [];

  const entries = patientData.docRefs;
  log(`Got ${entries.length} doc refs`);

  for (const [index, entry] of entries.entries()) {
    let prevDocId;
    try {
      prevDocId = entry.docRef.id;
      // TODO find a better way to define a unique doc ID
      entry.docRef.id = encodeExternalId(patient.id + "_" + index);
      const fhirDocId = entry.docRef.id;

      await convertCDAToFHIR({
        patient,
        document: { id: fhirDocId, mimeType: entry.docRef.content?.[0]?.attachment?.contentType },
        s3FileName: entry.s3Info.key,
        s3BucketName: entry.s3Info.bucket,
      });

      entry.docRef.contained?.push({
        resourceType: "Patient",
        id: patient.id,
      });
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

  return entries.map(d => d.docRef);
}
