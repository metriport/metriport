import { Bundle, BundleEntry, DocumentReference, Resource } from "@medplum/fhirtypes";
import { OutboundDocRetrievalRespParam } from "@metriport/core/external/carequality/ihe-gateway/outbound-result-poller-direct";
import { metriportDataSourceExtension } from "@metriport/core/external/fhir/shared/extensions/metriport";
import { MedicalDataSource } from "@metriport/core/external/index";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { errorToString } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { ingestIntoSearchEngine } from "../../aws/opensearch";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { convertCDAToFHIR, isConvertible } from "../../fhir-converter/converter";
import { DocumentReferenceWithId } from "../../fhir/document";
import { getDocumentsFromFHIR } from "../../fhir/document/get-documents";
import { upsertDocumentsToFHIRServer } from "../../fhir/document/save-document-reference";
import { setDocQueryProgress } from "../../hie/set-doc-query-progress";
import { tallyDocQueryProgress } from "../../hie/tally-doc-query-progress";
import { getCQDirectoryEntryOrFail } from "../command/cq-directory/get-cq-directory-entry";
import { formatDate } from "../shared";
import { getCQData } from "../patient";
import {
  DocumentReferenceWithMetriportId,
  containsMetriportId,
  cqToFHIR,
  dedupeContainedResources,
} from "./shared";

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
    let successDocsRetrievedCount = 0;
    let issuesWithExternalGateway = 0;

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
        downloadProgress: { total: 0, status: "completed" },
        convertProgress: { total: 0, status: "completed" },
        requestId,
        source: MedicalDataSource.CAREQUALITY,
      });

      return;
    }

    for (const docRetrievalResp of results) {
      if (docRetrievalResp.documentReference) {
        successDocsRetrievedCount += docRetrievalResp.documentReference.length;
      } else if (docRetrievalResp.operationOutcome?.issue) {
        issuesWithExternalGateway += docRetrievalResp.operationOutcome.issue.length;
      }
    }

    await setDocQueryProgress({
      patient: { id: patientId, cxId: cxId },
      downloadProgress: {
        total: successDocsRetrievedCount + issuesWithExternalGateway,
        status: "processing",
      },
      ...(successDocsRetrievedCount > 0
        ? {
            convertProgress: {
              total: successDocsRetrievedCount,
              status: "processing",
            },
          }
        : {
            convertProgress: { total: 0, status: "completed" },
          }),
      requestId,
      source: MedicalDataSource.CAREQUALITY,
    });

    const resultPromises = await Promise.allSettled(
      results.map(async docRetrievalResp => {
        const docRefs = docRetrievalResp.documentReference;

        if (docRefs) {
          const validDocRefs = docRefs.filter(containsMetriportId);
          await handleDocReferences(
            validDocRefs,
            requestId,
            patientId,
            cxId,
            docRetrievalResp.gateway.homeCommunityId
          );
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

    const patient = await getPatientOrFail({ id: patientId, cxId: cxId });
    const cqData = getCQData(patient.data.externalData);
    const docQueryStartedAt = cqData?.documentQueryProgress?.startedAt;
    const duration = elapsedTimeFromNow(docQueryStartedAt);
    const successfulGWS = results
      .filter(result => result.documentReference && result.documentReference.length > 0)
      .map(result => result.gateway.url);
    const failedGWS = results
      .filter(result => !result.documentReference || result.documentReference.length === 0)
      .map(result => result.gateway.url);

    analytics({
      distinctId: cxId,
      event: EventTypes.documentQuery,
      properties: {
        requestId,
        patientId,
        hie: MedicalDataSource.CAREQUALITY,
        duration,
        documentCount: successDocsRetrievedCount,
        successfulGWS,
        failedGWS,
      },
    });

    await tallyDocQueryProgress({
      patient: { id: patientId, cxId: cxId },
      progress: {
        successful: successDocsRetrievedCount,
        errors: issuesWithExternalGateway,
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
      convertProgress: { status: "failed" },
      requestId,
      source: MedicalDataSource.CAREQUALITY,
    });

    capture.message(msg, {
      extra: {
        context: `cq.processOutboundDocumentRetrievalResps`,
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
  cxId: string,
  cqOrganizationId: string
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

  const cqOrganization = await getCQDirectoryEntryOrFail(cqOrganizationId);

  for (const docRef of docRefs) {
    try {
      const isDocConvertible = isConvertible(docRef.contentType || undefined);
      const shouldConvert = isDocConvertible && docRef.isNew;

      const docLocation = docRef.fileLocation;
      const docPath = docRef.fileName;
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
        metriportDataSourceExtension,
        cqOrganization.name
      );
      const mergedFHIRDocRef: DocumentReferenceWithId = {
        ...fhirDocRef,
        description: fhirDocRef.description ?? draftFHIRDocRef?.description,
        content: [...(draftFHIRDocRef?.content ?? []), ...(fhirDocRef.content ?? [])],
        contained: combineAndDedupeContainedResources(draftFHIRDocRef, fhirDocRef),
        date: formatDate(fhirDocRef.date) ?? formatDate(draftFHIRDocRef?.date),
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

  await upsertDocumentsToFHIRServer(cxId, transactionBundle, log);

  await setDocQueryProgress({
    patient: { id: patientId, cxId: cxId },
    convertibleDownloadErrors: errorCountConvertible,
    increaseCountConvertible: adjustCountConvertible,
    requestId,
    source: MedicalDataSource.CAREQUALITY,
  });
}

function combineAndDedupeContainedResources(
  draftFHIRDocRef: DocumentReference | undefined,
  fhirDocRef: DocumentReferenceWithId
): Resource[] | undefined {
  const draftContained = draftFHIRDocRef?.contained ?? [];
  const fhirContained = fhirDocRef.contained ?? [];
  const combined = [...draftContained, ...fhirContained];

  return dedupeContainedResources(combined);
}
