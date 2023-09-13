import { DocumentReference } from "@medplum/fhirtypes";
import {
  MAPIWebhookStatus,
  processPatientDocumentRequest,
} from "../../../command/medical/document/document-webhook";
import { appendDocQueryProgress } from "../../../command/medical/patient/append-doc-query-progress";
import { Facility } from "../../../models/medical/facility";
import { Organization } from "../../../models/medical/organization";
import { Patient } from "../../../models/medical/patient";
import { toDTO } from "../../../routes/medical/dtos/documentDTO";
import { getSandboxSeedData } from "../../../shared/sandbox/sandbox-seed-data";
import { Util } from "../../../shared/util";
import { uuidv7 } from "../../../shared/uuid-v7";
import { convertCDAToFHIR, isConvertible } from "../../fhir-converter/converter";
import { upsertDocumentToFHIRServer } from "../../fhir/document/save-document-reference";
import { getFileExtension, sandboxSleepTime } from "./shared";

const randomDates = [
  "2023-06-15",
  "2023-06-10",
  "2023-06-12",
  "2023-06-20",
  "2023-03-22",
  "2022-12-03",
  "2018-09-29",
  "2022-07-21",
  "2019-04-10",
  "2023-05-03",
  "2020-02-19",
];

export async function sandboxGetDocRefsAndUpsert({
  organization,
  patient,
  requestId,
}: {
  organization: Organization;
  patient: Patient;
  facility: Facility;
  override?: boolean;
  requestId: string;
}): Promise<DocumentReference[]> {
  const { log } = Util.out(`sandboxGetDocRefsAndUpsert - M patient ${patient.id}`);

  // Mimic Prod by waiting for docs to download
  await Util.sleep(Math.random() * sandboxSleepTime);

  const patientData = getSandboxSeedData(patient.data.firstName);
  if (!patientData) {
    await appendDocQueryProgress({
      patient: { id: patient.id, cxId: patient.cxId },
      downloadProgress: {
        status: "completed",
      },
      requestId,
    });
    return [];
  }

  const entries = patientData.docRefs;
  log(`Got ${entries.length} doc refs`);

  const convertibleDocCount = patientData.docRefs
    .map(entry => {
      return {
        content: { mimeType: entry.docRef.content?.[0]?.attachment?.contentType },
      };
    })
    .filter(isConvertible).length;

  // set initial download/convert totals
  await appendDocQueryProgress({
    patient: { id: patient.id, cxId: patient.cxId },
    downloadProgress: {
      total: entries.length,
      status: "processing",
    },
    ...(convertibleDocCount > 0
      ? {
          convertProgress: {
            status: "processing",
            total: convertibleDocCount,
          },
        }
      : undefined),
    requestId,
  });

  for (const entry of entries) {
    const prevDocId = entry.docRef.id;
    entry.docRef.id = uuidv7();
    try {
      await convertCDAToFHIR({
        patient,
        document: {
          id: entry.docRef.id,
          content: { mimeType: entry.docRef.content?.[0]?.attachment?.contentType },
        },
        s3FileName: entry.s3Info.key,
        s3BucketName: entry.s3Info.bucket,
        requestId,
      });

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

      entry.docRef = addSandboxFields(entry.docRef);
      entry.docRef.contained = contained;
      await upsertDocumentToFHIRServer(patient.cxId, entry.docRef);
    } catch (err) {
      log(`Error w/ file docId ${entry.docRef.id}, prevDocId ${prevDocId}: ${err}`);
    }
  }

  // update download progress to completed, convert progress will be updated async
  // by the FHIR converter
  await appendDocQueryProgress({
    patient: { id: patient.id, cxId: patient.cxId },
    downloadProgress: {
      total: entries.length,
      status: "completed",
      successful: entries.length,
    },
    convertProgress: undefined,
    requestId,
  });

  const result = entries.map(d => d.docRef);

  processPatientDocumentRequest(
    organization.cxId,
    patient.id,
    "medical.document-download",
    MAPIWebhookStatus.completed,
    toDTO(result)
  );

  return result;
}

function addSandboxFields(docRef: DocumentReference): DocumentReference {
  if (docRef.content) {
    const fileExt = getFileExtension(docRef.content[0]?.attachment?.contentType);
    const randomIndex = Math.floor(Math.random() * randomDates.length);
    // Add a random date to the sandbox document
    if (docRef.content[0]?.attachment) {
      docRef.content[0].attachment.creation = randomDates[randomIndex];
    }

    if (randomIndex < 3) {
      docRef.status = "current";
    } else {
      docRef.status = "superseded";
    }

    if (fileExt === ".xml") {
      docRef.description = "C-CDA R2.1 Patient Record";
      docRef.type = {
        coding: [
          {
            system: "http://loinc.org/",
            code: "34133-9",
            display: "Summarization of episode note",
          },
        ],
      };
    } else if (fileExt === ".pdf") {
      (docRef.description = "Physical Examination"),
        (docRef.type = {
          coding: [
            {
              display: "Encounter",
            },
          ],
        });
    } else if (fileExt === ".tif" || fileExt === ".tiff") {
      (docRef.description = "Pathology Report"),
        (docRef.type = {
          coding: [
            {
              display: "Pathology Report",
            },
          ],
        });
    } else {
      (docRef.description = "Clinical Photograph or X-ray"),
        (docRef.type = {
          coding: [
            {
              display: "Photograph",
            },
          ],
        });
      docRef.status = "current";
    }
  }

  return docRef;
}
