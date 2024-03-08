import { Bundle, BundleEntry } from "@medplum/fhirtypes";
import { OutboundDocRetrievalRespParam } from "@metriport/core/external/carequality/ihe-gateway/outbound-result-poller-direct";
import { metriportDataSourceExtension } from "@metriport/core/external/fhir/shared/extensions/metriport";
import { MedicalDataSource } from "@metriport/core/external/index";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { errorToString } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { ingestIntoSearchEngine } from "../../aws/opensearch";
import { convertCDAToFHIR, isConvertible } from "../../fhir-converter/converter";
import { DocumentReferenceWithId } from "../../fhir/document";
import { getDocumentsFromFHIR } from "../../fhir/document/get-documents";
import { upsertDocumentsToFHIRServer } from "../../fhir/document/save-document-reference";
import { setDocQueryProgress } from "../../hie/set-doc-query-progress";
import { tallyDocQueryProgress } from "../../hie/tally-doc-query-progress";
import { containsMetriportId, cqToFHIR, DocumentReferenceWithMetriportId } from "./shared";

export async function processOutboundDocumentRetrievalResps({
  requestId,
  patientId,
  cxId,
  results,
}: OutboundDocRetrievalRespParam): Promise<void> {
  const { log } = out(
    `CQ processOutboundDocumentRetrievalResps - requestId ${requestId}, patient ${patientId}`
  );
  try {
    let newDocRefCount = 0;
    let issuesWithGateway = 0;
    let successDocsCount = 0;

    if (results.length === 0) {
      const msg = `Received DR result without entries.`;

      log(`${msg}`);
      capture.message(msg, {
        extra: {
          context: `cq.processOutboundDocumentRetrievalResps`,
          patientId: patientId,
          requestId,
          cxId,
          results,
        },
        level: "warning",
      });

      await setDocQueryProgress({
        patient: { id: patientId, cxId: cxId },
        downloadProgress: { status: "completed" },
        convertProgress: { status: "completed" },
        requestId,
        source: MedicalDataSource.CAREQUALITY,
      });

      return;
    }

    for (const docRetrievalResp of results) {
      newDocRefCount += docRetrievalResp.documentReference?.length ?? 0;
    }

    await setDocQueryProgress({
      patient: { id: patientId, cxId: cxId },
      downloadProgress: {
        total: newDocRefCount,
        status: "processing",
      },
      convertProgress: {
        total: newDocRefCount,
        status: "processing",
      },
      requestId,
      source: MedicalDataSource.CAREQUALITY,
    });

    const resultPromises = await Promise.allSettled(
      results.map(async docRetrievalResp => {
        const { operationOutcome } = docRetrievalResp;
        if (operationOutcome?.issue) {
          issuesWithGateway += operationOutcome.issue.length;
        }
        const docRefs = docRetrievalResp.documentReference;
        if (docRefs) {
          const validDocRefs = docRefs.filter(containsMetriportId);
          await handleDocReferences(validDocRefs, requestId, patientId, cxId);
          successDocsCount += docRefs.length;
        }
      })
    );

    const failed = resultPromises.flatMap(p => (p.status === "rejected" ? p.reason : []));

    if (failed.length > 0) {
      const msg = `Failed to handle doc references in Carequality`;
      log(`${msg}`);

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
  } catch (error) {
    const msg = `Failed to process documents in Carequality.`;
    log(`${msg}. Error: ${errorToString(error)}`);

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
  docRefs: DocumentReferenceWithMetriportId[],
  requestId: string,
  patientId: string,
  cxId: string
) {
  let errorCountConvertible = 0;
  let adjustCountConvertible = 0;

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
    try {
      const isDocConvertible = isConvertible(docRef.contentType || undefined);
      const shouldConvert = isDocConvertible && docRef.isNew;

      const docLocation = docRef.fileLocation;
      const docPath = docRef.url;
      if (!docLocation || !docPath) {
        throw new MetriportError(`Invalid doc ref: location or path missing.`, undefined, {
          docRefId: docRef.metriportId,
        });
      }

      if (shouldConvert) {
        await convertCDAToFHIR({
          patient: {
            id: patientId,
            cxId,
          },
          document: {
            id: docRef.metriportId ?? "",
            content: { mimeType: docRef.contentType ?? "" },
          },
          s3FileName: docPath,
          s3BucketName: docLocation,
          requestId,
          source: MedicalDataSource.CAREQUALITY,
        });
      } else {
        adjustCountConvertible--;
      }

      const draftFHIRDocRef = existingFHIRDocRefs.find(
        fhirDocRef => fhirDocRef.id === docRef.metriportId
      );

      const fhirDocRef = cqToFHIR(
        docRef.metriportId,
        docRef,
        "final",
        patientId,
        metriportDataSourceExtension
      );
      const mergedFHIRDocRef: DocumentReferenceWithId = {
        ...fhirDocRef,
        description: fhirDocRef.description ?? draftFHIRDocRef?.description,
        content: [...(draftFHIRDocRef?.content ?? []), ...(fhirDocRef.content ?? [])],
      };

      if (!docRef.contentType) {
        throw new MetriportError(`Invalid doc ref: content type missing.`, undefined, {
          docRefId: docRef.metriportId,
        });
      }

      const file = {
        key: docPath,
        bucket: docLocation,
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
    } catch (error) {
      const msg = `Error handling doc reference`;
      const extra = {
        context: "cq.handleDocReferences",
        patientId,
        requestId,
        cxId,
        docRef,
      };
      log(`${msg}: ${errorToString(error)}, ${JSON.stringify(extra)}`);
      capture.error(msg, {
        extra: { ...extra, error },
      });
      errorCountConvertible++;
    }
  }

  await upsertDocumentsToFHIRServer(cxId, transactionBundle);

  await setDocQueryProgress({
    patient: { id: patientId, cxId: cxId },
    convertibleDownloadErrors: errorCountConvertible,
    increaseCountConvertible: adjustCountConvertible,
    requestId,
    source: MedicalDataSource.CAREQUALITY,
  });
}
