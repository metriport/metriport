import { Bundle, BundleEntry, DocumentReference, Resource } from "@medplum/fhirtypes";
import { EventTypes, analytics } from "@metriport/core/external/analytics/posthog";
import { OutboundDocRetrievalRespParam } from "@metriport/core/external/carequality/ihe-gateway/outbound-result-poller-direct";
import { metriportDataSourceExtension } from "@metriport/core/external/fhir/shared/extensions/metriport";
import { MedicalDataSource } from "@metriport/core/external/index";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { MetriportError, errorToString } from "@metriport/shared";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { ingestIntoSearchEngine } from "../../aws/opensearch";
import { convertCDAToFHIR, isConvertible } from "../../fhir-converter/converter";
import { DocumentReferenceWithId } from "../../fhir/document";
import { upsertDocumentsToFHIRServer } from "../../fhir/document/save-document-reference";
import { getCQDirectoryEntryOrFail } from "../command/cq-directory/get-cq-directory-entry";
import { formatDate } from "../shared";
import {
  DocumentReferenceWithMetriportId,
  containsDuplicateMetriportId,
  containsMetriportId,
  cqToFHIR,
  dedupeContainedResources,
} from "./shared";

import { getDocuments } from "@metriport/core/external/fhir/document/get-documents";
import {
  incrementDocumentQueryAndProcessWebhook,
  setDocumentQuery,
  setDocumentQueryStatusAndProcessWebhook,
} from "../../../command/medical/document-query";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { getOutboundDocRetrievalSuccessFailureCount } from "../../hie/carequality-analytics";
import { getCQData } from "../patient";

export async function processOutboundDocumentRetrievalResps({
  requestId,
  patientId,
  cxId,
  results,
}: OutboundDocRetrievalRespParam): Promise<void> {
  const { log } = out(
    `CQ processOutboundDocumentRetrievalResps - requestId ${requestId}, patient ${patientId}`
  );

  const docQueryParms = {
    cxId,
    patientId,
    requestId,
    source: MedicalDataSource.CAREQUALITY,
  };

  try {
    const patient = await getPatientOrFail({ id: patientId, cxId: cxId });
    const cqData = getCQData(patient.data.externalData);
    const docRetrievalStartedAt = cqData?.documentRetrievalStartTime;
    const duration = elapsedTimeFromNow(docRetrievalStartedAt);
    const { successCount, failureCount } = getOutboundDocRetrievalSuccessFailureCount(results);

    analytics({
      distinctId: cxId,
      event: EventTypes.documentRetrieval,
      properties: {
        requestId,
        patientId,
        hie: MedicalDataSource.CAREQUALITY,
        successCount,
        failureCount,
        duration,
      },
    });

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

      await Promise.all([
        setDocumentQueryStatusAndProcessWebhook({
          ...docQueryParms,
          progressType: "download",
          status: "completed",
        }),
        setDocumentQueryStatusAndProcessWebhook({
          ...docQueryParms,
          progressType: "convert",
          status: "completed",
        }),
      ]);
      return;
    }

    const validDeduplicatedDocRefsByReult: {
      docRefs: DocumentReferenceWithMetriportId[];
      errors: unknown[];
      requestId: string;
      patientId: string;
      cxId: string;
      cqOrganizationId: string;
    }[] = results.flatMap(docRetrievalResp => {
      const docRefs = docRetrievalResp.documentReference ?? [];
      const errors = docRetrievalResp.operationOutcome?.issue ?? [];
      const validDocRefs = docRefs.filter(containsMetriportId);
      const validDeduplicatedDocRefs = validDocRefs.filter(docRef => {
        const isDuplicate = containsDuplicateMetriportId(docRef, seenMetriportIds);
        if (isDuplicate) {
          capture.message(`Duplicate docRef found in DR Resp`, {
            extra: {
              context: `cq.processOutboundDocumentRetrievalResps`,
              patientId,
              requestId,
              cxId,
              docRef,
            },
            level: "warning",
          });
        }
        return !isDuplicate;
      });

      return {
        docRefs: validDeduplicatedDocRefs,
        errors,
        requestId,
        patientId,
        cxId,
        cqOrganizationId: docRetrievalResp.gateway.homeCommunityId,
      };
    });

    const successDocsRetrievedCount = 0;
    const issuesWithExternalGateway = 0;

    validDeduplicatedDocRefsByReult.reduce(
      (acc, docRetrievalResp) => {
        acc.successDocsRetrievedCount += docRetrievalResp.docRefs.length;
        acc.issuesWithExternalGateway += docRetrievalResp.errors.length;
        return acc;
      },
      { successDocsRetrievedCount, issuesWithExternalGateway }
    );

    await Promise.all([
      setDocumentQuery({
        ...docQueryParms,
        progressType: "download",
        field: "Total",
        value: successDocsRetrievedCount + issuesWithExternalGateway,
      }),
      successDocsRetrievedCount > 0 &&
        setDocumentQuery({
          ...docQueryParms,
          progressType: "convert",
          field: "Total",
          value: successDocsRetrievedCount,
        }),
    ]);

    const seenMetriportIds = new Set<string>();
    const resultPromises = await Promise.allSettled(
      validDeduplicatedDocRefsByReult.map(async args => {
        await handleDocReferences({ ...args });
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

    await Promise.all([
      incrementDocumentQueryAndProcessWebhook({
        ...docQueryParms,
        progressType: "download",
        field: "Success",
        value: successDocsRetrievedCount,
      }),
      incrementDocumentQueryAndProcessWebhook({
        ...docQueryParms,
        progressType: "download",
        field: "Error",
        value: issuesWithExternalGateway,
      }),
    ]);
  } catch (error) {
    const msg = `Failed to process documents in Carequality.`;
    log(`${msg}. Error: ${errorToString(error)}`);

    await Promise.all([
      setDocumentQueryStatusAndProcessWebhook({
        ...docQueryParms,
        progressType: "download",
        status: "failed",
      }),
      setDocumentQueryStatusAndProcessWebhook({
        ...docQueryParms,
        progressType: "convert",
        status: "failed",
      }),
    ]);

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

async function handleDocReferences({
  docRefs,
  requestId,
  patientId,
  cxId,
  cqOrganizationId,
}: {
  docRefs: DocumentReferenceWithMetriportId[];
  requestId: string;
  patientId: string;
  cxId: string;
  cqOrganizationId: string;
}) {
  const { log } = out(`CQ handleDocReferences - requestId ${requestId}, M patient ${patientId}`);

  const existingFHIRDocRefs = await getDocuments({
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

  const docQueryParms = {
    cxId,
    patientId,
    requestId,
    source: MedicalDataSource.CAREQUALITY,
  };

  for (const docRef of docRefs) {
    try {
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
      const docLocation = docRef.fileLocation;
      const docPath = docRef.fileName;
      const docContentType = docRef.contentType;
      if (!docLocation || !docPath || !docContentType) {
        throw new MetriportError(`Invalid doc ref: location or path missing.`, undefined, {
          docRefId: docRef.metriportId,
        });
      }
      const file = {
        key: docPath,
        bucket: docLocation,
        contentType: docContentType,
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

      const isConvertibleDoc = isConvertible(docRef.contentType || undefined);

      if (!isConvertibleDoc) {
        await incrementDocumentQueryAndProcessWebhook({
          ...docQueryParms,
          progressType: "convert",
          field: "Total",
          value: -1,
        });
      }

      if (!docRef.isNew && isConvertibleDoc) {
        await incrementDocumentQueryAndProcessWebhook({
          ...docQueryParms,
          progressType: "convert",
          field: "Success",
        });
      }

      if (docRef.isNew && isConvertibleDoc) {
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
            s3FileName: docPath,
            s3BucketName: docLocation,
            requestId,
            source: MedicalDataSource.CAREQUALITY,
          });
        } catch (err) {
          log(
            `Error triggering conversion of doc ${
              docRef.metriportId ?? ""
            }, just increasing errorCountConvertible - ${err}`
          );
          await incrementDocumentQueryAndProcessWebhook({
            ...docQueryParms,
            progressType: "convert",
            field: "Error",
          });
        }
      }
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
    }
  }

  await upsertDocumentsToFHIRServer(cxId, transactionBundle, log);
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
