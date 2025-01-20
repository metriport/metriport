import { Bundle } from "@medplum/fhirtypes";
import { conversionBundleSuffix } from "@metriport/core/command/consolidated/consolidated-create";
import { createFilePath } from "@metriport/core/domain/filename";
import { Patient } from "@metriport/core/domain/patient";
import { executeWithRetriesS3, S3Utils } from "@metriport/core/external/aws/s3";
import { getDocuments } from "@metriport/core/external/fhir/document/get-documents";
import { parseRawBundleForFhirServer } from "@metriport/core/external/fhir/parse-bundle";
import { metriportDataSourceExtension } from "@metriport/core/external/fhir/shared/extensions/metriport";
import { out } from "@metriport/core/util";
import { getFileExtension } from "@metriport/core/util/mime";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import {
  MAPIWebhookStatus,
  processPatientDocumentRequest,
} from "../../../command/medical/document/document-webhook";
import { appendDocQueryProgress } from "../../../command/medical/patient/append-doc-query-progress";
import { recreateConsolidated } from "../../../command/medical/patient/consolidated-recreate";
import { toDTO } from "../../../routes/medical/dtos/documentDTO";
import { Config } from "../../../shared/config";
import { getSandboxSeedData } from "../../../shared/sandbox/sandbox-seed-data";
import { Util } from "../../../shared/util";
import { ContentMimeType, isConvertible } from "../../fhir-converter/converter";
import { DocumentReferenceWithId } from "../../fhir/document";
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
  const { id: patientId, cxId } = patient;

  // Mimic Prod by waiting for docs to download
  await Util.sleep(Math.random() * sandboxSleepTime.asMilliseconds());

  const patientData = getSandboxSeedData(patient.data.firstName);
  if (!patientData) {
    await appendDocQueryProgress({
      patient,
      downloadProgress: {
        status: "completed",
      },
      reset: true,
      requestId,
    });
    processPatientDocumentRequest(
      cxId,
      patientId,
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
      originalId: entry.docRef.id,
      content: { mimeType: entry.docRef.content?.[0]?.attachment?.contentType },
    };
  });

  const convertibleDocs = docsWithContent.filter(doc => isConvertible(doc.content?.mimeType));
  const convertibleDocCount = convertibleDocs.length;
  const existingFhirDocs = await getDocuments({
    cxId,
    patientId,
  });
  const existingDocTitles = existingFhirDocs.flatMap(d => d.content?.[0]?.attachment?.title ?? []);

  // set initial download/convert totals
  await appendDocQueryProgress({
    patient,
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

  for (const entry of docsWithContent) {
    const fileTitle = entry.docRef.content?.[0]?.attachment?.title;
    // if it doesnt exist were adding it to the fhir server as a reference
    if (!fileTitle || !existingDocTitles.includes(fileTitle)) {
      const prevDocId = entry.docRef.id;
      // Replace the docRef ID because the FHIR server doesn't allow more than one ID across the
      // whole install - it's not per tenant.
      entry.docRef.id = uuidv7();
      try {
        const contained = entry.docRef.contained ?? [];
        const containsPatient = contained.filter(c => c.resourceType === "Patient").length > 0;
        if (!containsPatient) {
          contained.push({
            resourceType: "Patient",
            id: patientId,
          });
        }
        entry.docRef.subject = {
          type: "Patient",
          reference: `Patient/${patientId}`,
        };

        entry.docRef.contained = contained;
        entry.docRef = addSandboxFields(entry.docRef);
        await upsertDocumentToFHIRServer(cxId, entry.docRef);
      } catch (err) {
        log(`Error w/ file docId ${entry.docRef.id}, prevDocId ${prevDocId}: ${err}`);
      }
    } else {
      log(`Skipping inserting DocRef for ${fileTitle} on FHIR server as it already exists`);
    }
    // Always "converting" so any issues can be automatically fixed by running it again
    if (convertibleDocs.find(d => d.originalId === entry.originalId)) {
      await sandboxConvertCDAToFHIR({
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
  }

  // After docs are converted (and conversion bundles are stored in S3), we recreate the consolidated
  // bundle to make sure it's up-to-date.
  await recreateConsolidated({ patient });

  await appendDocQueryProgress({
    patient: { id: patientId, cxId },
    downloadProgress: {
      total: entries.length,
      status: "completed",
      successful: entries.length,
    },
    convertProgress: {
      total: convertibleDocCount,
      status: "completed",
    },
    requestId,
  });

  const result = entries.map(d => d.docRef);
  processPatientDocumentRequest(
    cxId,
    patientId,
    "medical.document-download",
    MAPIWebhookStatus.completed,
    requestId,
    toDTO(result)
  );
  processPatientDocumentRequest(
    cxId,
    patientId,
    "medical.document-conversion",
    MAPIWebhookStatus.completed,
    ""
  );

  return;
}

/**
 * Sandbox version of the convertCDAToFHIR() function.
 */
async function sandboxConvertCDAToFHIR(params: {
  patient: { cxId: string; id: string };
  document: { id: string; content?: ContentMimeType };
  s3FileName: string;
  s3BucketName: string;
  requestId: string;
}) {
  const { patient, document, s3FileName, s3BucketName, requestId } = params;
  const { log } = out(
    `sandboxConvertCDAToFHIR, pat ${patient.id}, reqId ${requestId}, docId ${document.id}`
  );
  const sourceBucketName = s3BucketName;
  const sourceFileName = s3FileName.replace(".xml", ".json");
  const sourceFilePath = sourceFileName;
  const destinationBucketName = Config.getCdaToFhirConversionBucketName();
  const destinationFileName = sourceFileName.replace(".json", conversionBundleSuffix);
  const destinationFilePath = createFilePath(patient.cxId, patient.id, destinationFileName);
  const s3Params = { sourceBucketName, sourceFilePath, destinationBucketName, destinationFilePath };
  log(
    `Bypassing conversion, storing the pre-canned JSON on the conversion bucket` +
      ` - ${JSON.stringify(s3Params)}`
  );
  await copyPrecannedBundleToConversionBucket({ patientId: patient.id, ...s3Params, log });
}

async function copyPrecannedBundleToConversionBucket({
  patientId,
  sourceBucketName,
  sourceFilePath,
  destinationBucketName,
  destinationFilePath,
  log,
}: {
  patientId: string;
  sourceBucketName: string;
  sourceFilePath: string;
  destinationBucketName: string;
  destinationFilePath: string;
  log: typeof console.log;
}) {
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const payloadRaw = await executeWithRetriesS3(
    () => s3Utils.getFileContentsAsString(sourceBucketName, sourceFilePath),
    { log }
  );
  // We need to replace the placeholder patient ID with the actual patient ID
  const payload: Bundle = parseRawBundleForFhirServer(payloadRaw, patientId);
  await s3Utils.uploadFile({
    bucket: destinationBucketName,
    key: destinationFilePath,
    file: Buffer.from(JSON.stringify(payload)),
    contentType: "application/json",
  });
}

function addSandboxFields(docRef: DocumentReferenceWithId): DocumentReferenceWithId {
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
