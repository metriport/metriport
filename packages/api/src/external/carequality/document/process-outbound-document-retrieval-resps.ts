import { out } from "@metriport/core/util/log";
import { Bundle, BundleEntry } from "@medplum/fhirtypes";
import { errorToString } from "@metriport/core/util/error/shared";
import { capture } from "@metriport/core/util/notifications";
import { DocumentReference, OutboundDocumentRetrievalResp } from "@metriport/ihe-gateway-sdk";
import { MedicalDataSource } from "@metriport/core/external/index";
import { isConvertible } from "../../fhir-converter/converter";
import { setDocQueryProgress } from "../../hie/set-doc-query-progress";
import { tallyDocQueryProgress } from "../../hie/tally-doc-query-progress";
import { convertCDAToFHIR } from "../../fhir-converter/converter";
import { upsertDocumentsToFHIRServer } from "../../fhir/document/save-document-reference";
import { cqToFHIR } from "./shared";
import { getDocumentsFromFHIR } from "../../fhir/document/get-documents";
import { ingestIntoSearchEngine } from "../../aws/opensearch";
import { metriportDataSourceExtension } from "../../fhir/shared/extensions/metriport";
import { DocumentReferenceWithId } from "../../fhir/document";

export async function processOutboundDocumentRetrievalResps({
  requestId,
  patientId,
  cxId,
  outboundDocRetrievalResps,
}: {
  requestId: string;
  patientId: string;
  cxId: string;
  outboundDocRetrievalResps: OutboundDocumentRetrievalResp[];
}): Promise<void> {
  try {
    let issuesWithGateway = 0;
    let successDocsCount = 0;

    const resultPromises = await Promise.allSettled(
      outboundDocRetrievalResps.map(async docRetrievalResp => {
        const { operationOutcome } = docRetrievalResp;

        if (operationOutcome?.issue) {
          issuesWithGateway += operationOutcome.issue.length;
        }

        if (docRetrievalResp.documentReference) {
          successDocsCount += docRetrievalResp.documentReference.length;
        }
        await handleDocReferences(docRetrievalResp.documentReference, requestId, patientId, cxId);
      })
    );

    const failed = resultPromises.flatMap(p => (p.status === "rejected" ? p.reason : []));

    if (failed.length > 0) {
      const msg = `Failed to handle doc references in Carequality`;
      console.log(`${msg}`);

      capture.message(msg, {
        extra: {
          context: `cq.handleDocReferences`,
          patientId: patientId,
          requestId,
          cxId,
        },
        level: "error",
      });
    }

    await tallyDocQueryProgress({
      patient: { id: patientId, cxId: cxId },
      progress: {
        successful: successDocsCount,
        errors: issuesWithGateway,
      },
      type: "download",
      requestId,
      source: MedicalDataSource.CAREQUALITY,
    });

    await setDocQueryProgress({
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

    await setDocQueryProgress({
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
  let errorCountConvertible = 0;

  const { log } = out(`CQ handleDocReferences - requestId ${requestId}, M patient ${patientId}`);

  const existingFHIRDocRefs = await getDocumentsFromFHIR({
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
    const isDocConvertible = isConvertible(docRef.contentType || undefined);
    const shouldConvert = isDocConvertible && docRef.isNew;

    if (!docRef.isNew) {
      errorCountConvertible++;
    }

    if (shouldConvert) {
      try {
        if (!docRef.fileLocation || !docRef.fileName) {
          throw new Error(`File location or file name is missing for doc ${docRef.metriportId}`);
        }

        await convertCDAToFHIR({
          patient: {
            id: patientId,
            cxId,
          },
          document: {
            id: docRef.metriportId ?? "",
            content: { mimeType: docRef.contentType ?? "" },
          },
          s3FileName: docRef.fileName,
          s3BucketName: docRef.fileLocation,
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
    const draftFHIRDocRef = existingFHIRDocRefs.find(
      fhirDocRef => fhirDocRef.id === docRef.metriportId
    );

    const docId = docRef.metriportId ?? "";

    const fhirDocRef = cqToFHIR(docId, docRef, "final", patientId, metriportDataSourceExtension);
    const mergedFHIRDocRef: DocumentReferenceWithId = {
      ...fhirDocRef,
      content: [...(draftFHIRDocRef?.content ?? []), ...(fhirDocRef.content ?? [])],
    };

    if (!docRef.fileLocation || !docRef.url || !docRef.contentType) {
      throw new Error(
        `Doc ${docRef.metriportId} is not valid. File location, file name or content type is missing.`
      );
    }

    const file = {
      key: docRef.url,
      bucket: docRef.fileLocation,
      contentType: docRef.contentType,
    };

    const transactionEntry: BundleEntry = {
      resource: mergedFHIRDocRef,
      request: {
        method: "PUT",
        url: mergedFHIRDocRef.resourceType + "/" + mergedFHIRDocRef.id,
      },
    };

    transactionBundle.entry?.push(transactionEntry);

    ingestIntoSearchEngine({ id: patientId, cxId }, mergedFHIRDocRef, file, requestId, log);
  }

  await upsertDocumentsToFHIRServer(cxId, transactionBundle);

  await setDocQueryProgress({
    patient: { id: patientId, cxId: cxId },
    convertibleDownloadErrors: errorCountConvertible,
    requestId,
    source: MedicalDataSource.CAREQUALITY,
  });
}
