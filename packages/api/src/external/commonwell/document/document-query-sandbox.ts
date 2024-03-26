import { DocumentReference } from "@medplum/fhirtypes";
import { Patient } from "@metriport/core/domain/patient";
import { getFileExtension } from "@metriport/core/util/mime";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { metriportDataSourceExtension } from "@metriport/core/external/fhir/shared/extensions/metriport";
import {
  MAPIWebhookStatus,
  processPatientDocumentRequest,
} from "../../../command/medical/document/document-webhook";
import { appendDocQueryProgress } from "../../../command/medical/patient/append-doc-query-progress";
import { toDTO } from "../../../routes/medical/dtos/documentDTO";
import { getSandboxSeedData } from "../../../shared/sandbox/sandbox-seed-data";
import { Util } from "../../../shared/util";
import { convertCDAToFHIR, isConvertible } from "../../fhir-converter/converter";
import { getDocumentsFromFHIR } from "../../fhir/document/get-documents";
import { upsertDocumentToFHIRServer } from "../../fhir/document/save-document-reference";
import { sandboxSleepTime } from "./shared";

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
  patient,
  requestId,
}: {
  patient: Patient;
  requestId: string;
}): Promise<void> {
  const { log } = Util.out(`sandboxGetDocRefsAndUpsert - M patient ${patient.id}`);
  const { id, cxId } = patient;

  // Mimic Prod by waiting for docs to download
  await Util.sleep(Math.random() * sandboxSleepTime);

  const patientData = getSandboxSeedData(patient.data.firstName);
  if (!patientData) {
    await appendDocQueryProgress({
      patient: { id: id, cxId: cxId },
      downloadProgress: {
        status: "completed",
      },
      reset: true,
      requestId,
    });

    processPatientDocumentRequest(
      cxId,
      id,
      "medical.document-download",
      MAPIWebhookStatus.completed,
      requestId,
      []
    );

    return;
  }

  const entries = patientData.docRefs;
  log(`Got ${entries.length} doc refs`);

  const docsWithContent = entries.map(entry => {
    return {
      ...entry,
      content: { mimeType: entry.docRef.content?.[0]?.attachment?.contentType },
    };
  });

  const convertibleDocs = docsWithContent.filter(doc => isConvertible(doc.content?.mimeType));
  const convertibleDocCount = convertibleDocs.length;
  const existingFhirDocs = await getDocumentsFromFHIR({
    cxId: cxId,
    patientId: id,
  });
  const existingDocTitles = existingFhirDocs.flatMap(d => d.content?.[0]?.attachment?.title ?? []);

  // set initial download/convert totals
  await appendDocQueryProgress({
    patient: { id: id, cxId: cxId },
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

  let docsToConvert: number = convertibleDocCount;

  for (const entry of docsWithContent) {
    const fileTitle = entry.docRef.content?.[0]?.attachment?.title;
    // if it doesnt exist were adding it to the fhir server as a reference
    if (!fileTitle || !existingDocTitles.includes(fileTitle)) {
      const prevDocId = entry.docRef.id;
      entry.docRef.id = uuidv7();
      try {
        if (convertibleDocs.find(d => d.docRef.id === entry.docRef.id)) {
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
        }

        const contained = entry.docRef.contained ?? [];
        const containsPatient = contained.filter(c => c.resourceType === "Patient").length > 0;
        if (!containsPatient) {
          contained.push({
            resourceType: "Patient",
            id: id,
          });
        }
        entry.docRef.subject = {
          type: "Patient",
          reference: `Patient/${id}`,
        };

        entry.docRef.contained = contained;
        entry.docRef = addSandboxFields(entry.docRef);
        await upsertDocumentToFHIRServer(cxId, entry.docRef);
      } catch (err) {
        log(`Error w/ file docId ${entry.docRef.id}, prevDocId ${prevDocId}: ${err}`);
      }
    } else {
      log(`Skipping file ${fileTitle} as it already exists`);
      const isDocConvertible = isConvertible(entry.content?.mimeType);

      if (isDocConvertible) {
        docsToConvert = docsToConvert - 1;
      }
    }
  }

  // update download progress to completed, convert progress will be updated async
  // by the FHIR converter
  await appendDocQueryProgress({
    patient: { id: id, cxId: cxId },
    downloadProgress: {
      total: entries.length,
      status: "completed",
      successful: entries.length,
    },
    convertProgress:
      docsToConvert <= 0
        ? {
            total: 0,
            status: "completed",
          }
        : {
            total: docsToConvert,
            status: "processing",
          },
    requestId,
  });

  const result = entries.map(d => d.docRef);

  processPatientDocumentRequest(
    cxId,
    id,
    "medical.document-download",
    MAPIWebhookStatus.completed,
    requestId,
    toDTO(result)
  );

  return;
}

function addSandboxFields(docRef: DocumentReference): DocumentReference {
  if (docRef.content) {
    const fileExt = getFileExtension(docRef.content[0]?.attachment?.contentType);
    const randomIndex = Math.floor(Math.random() * randomDates.length);
    // Add a random date to the sandbox document
    if (docRef.content[0]?.attachment) {
      docRef.content[0].attachment.creation =
        docRef.content[0].attachment.creation ?? randomDates[randomIndex];
      docRef.content[0].attachment.size =
        docRef.content[0].attachment.size ?? Math.floor(Math.random() * 100000);
    }

    if (docRef.content[0] && !docRef.content[0].extension) {
      docRef.content[0].extension = [metriportDataSourceExtension];
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

  docRef.date = docRef.date ?? docRef.content?.[0]?.attachment?.creation;

  docRef.contained?.push({
    resourceType: "Organization",
    id: "Sandbox example org",
    name: `Hospital org#${Math.floor(Math.random() * 1000)}`,
  });

  return docRef;
}
