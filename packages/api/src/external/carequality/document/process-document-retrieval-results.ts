import { out } from "@metriport/core/util/log";
import { Bundle, BundleEntry } from "@medplum/fhirtypes";
import { errorToString } from "@metriport/core/util/error/index";
import { capture } from "@metriport/core/util/notifications";
import { DocumentReference } from "@metriport/ihe-gateway-sdk";
import { MedicalDataSource } from "@metriport/core/external/index";
import { DocumentRetrievalResult } from "../document-retrieval-result";
import { isConvertible } from "../../fhir-converter/converter";
import { setDocQueryProgressWithSource } from "../../hie/set-doc-query-progress-with-source";
import { tallyDocQueryProgressWithSource } from "../../hie/tally-doc-query-progress-with-source";
import { convertCDAToFHIR } from "../../fhir-converter/converter";
import { upsertDocumentsToFHIRServer } from "../../fhir/document/save-document-reference";
import { cqToFHIR } from "../../fhir/document";
import { getDocuments } from "../../fhir/document/get-documents";
import { ingestIntoSearchEngine } from "../../aws/opensearch";

export async function processDocumentRetrievalResults({
  requestId,
  patientId,
  cxId,
  documentRetrievalResults,
}: {
  requestId: string;
  patientId: string;
  cxId: string;
  documentRetrievalResults: DocumentRetrievalResult[];
}): Promise<void> {
  try {
    for (const result of documentRetrievalResults) {
      const { operationOutcome } = result.data;
      const issuesWithGateway = operationOutcome?.issue?.length ?? 0;
      const successDocsCount = result.data.documentReference?.length ?? 0;

      tallyDocQueryProgressWithSource({
        patient: { id: patientId, cxId: cxId },
        progress: {
          successful: successDocsCount,
          errors: issuesWithGateway,
        },
        type: "download",
        requestId,
        source: MedicalDataSource.CAREQUALITY,
      });

      await handleDocReferences(result.data.documentReference, requestId, patientId, cxId);
    }

    await setDocQueryProgressWithSource({
      patient: { id: patientId, cxId: cxId },
      downloadProgress: {
        status: "completed",
      },
      requestId,
      source: MedicalDataSource.CAREQUALITY,
    });
  } catch (error) {
    const msg = `Failed to process documents in Carequality.`;
    console.log(`${msg}. Error: ${errorToString(error)}`);

    await setDocQueryProgressWithSource({
      patient: { id: patientId, cxId: cxId },
      downloadProgress: { status: "failed" },
      requestId,
      source: MedicalDataSource.CAREQUALITY,
    });

    capture.message(msg, {
      extra: {
        context: `cq.processingDocuments`,
        error,
        patientId: patientId,
        requestId,
        cxId,
      },
      level: "error",
    });
    throw error;
  }
}

async function handleDocReferences(
  docRefs: DocumentReference[],
  requestId: string,
  patientId: string,
  cxId: string
) {
  // REMINDER: YOU NEED TO UPDATE MIRTH TO SEND THE ABOVE

  let errorCountConvertible = 0;

  const { log } = out(`CQ handleDocReferences - requestId ${requestId}, M patient ${patientId}`);

  const currentFHIRDocRefs = await getDocuments({
    cxId,
    patientId,
    documentIds: docRefs.map(doc => doc.metriportId ?? ""),
  });

  const transactionBundle: Bundle = {
    resourceType: "Bundle",
    type: "transaction",
    entry: [],
  };

  for (const docRef of docRefs) {
    const isDocConvertible = isConvertible(docRef.contentType);
    const shouldConvert = isDocConvertible && docRef.isNew;

    if (!docRef.isNew) {
      errorCountConvertible++;
    }

    if (shouldConvert) {
      try {
        await convertCDAToFHIR({
          patient: {
            id: patientId,
            cxId,
          },
          document: {
            id: docRef.metriportId ?? "",
            content: { mimeType: docRef.contentType ?? "" },
          },
          s3FileName: docRef.url ?? "",
          s3BucketName: docRef.bucketName ?? "",
          requestId,
          source: MedicalDataSource.CAREQUALITY,
        });
      } catch (err) {
        // don't fail/throw or send to Sentry here, we already did that on the convertCDAToFHIR function
        log(
          `Error triggering conversion of doc ${docRef.metriportId}, just increasing errorCountConvertible - ${err}`
        );
        errorCountConvertible++;
      }
    }

    const currentFHIRDocRef = currentFHIRDocRefs.filter(
      fhirDocRef => fhirDocRef.id === docRef.metriportId
    );

    const docId = docRef.metriportId ?? "";

    const FHIRDocRef = cqToFHIR(docId, docRef, patientId, currentFHIRDocRef[0]);

    const file = {
      key: docRef.url ?? "",
      bucket: docRef.bucketName ?? "",
      contentType: docRef.contentType ?? "",
    };

    const transactionEntry: BundleEntry = {
      resource: FHIRDocRef,
      request: {
        method: "PUT",
        url: FHIRDocRef.resourceType + "/" + FHIRDocRef.id,
      },
    };

    transactionBundle.entry?.push(transactionEntry);

    await ingestIntoSearchEngine({ id: patientId, cxId }, FHIRDocRef, file, requestId, log);
  }

  await upsertDocumentsToFHIRServer(cxId, transactionBundle, log);

  await setDocQueryProgressWithSource({
    patient: { id: patientId, cxId: cxId },
    convertibleDownloadErrors: errorCountConvertible,
    requestId,
    source: MedicalDataSource.CAREQUALITY,
  });
}
