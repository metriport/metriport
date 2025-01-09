import { Bundle, BundleEntry, DocumentReference, Resource } from "@medplum/fhirtypes";
import { OutboundDocRetrievalRespParam } from "@metriport/core/external/carequality/ihe-gateway/outbound-result-poller-direct";
import { metriportDataSourceExtension } from "@metriport/core/external/fhir/shared/extensions/metriport";
import { MedicalDataSource } from "@metriport/core/external/index";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { errorToString } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { capture } from "@metriport/core/util/notifications";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { stripUrnPrefix } from "@metriport/core/util/urn";
import { Issue } from "@metriport/ihe-gateway-sdk/models/shared";
import { ingestIntoSearchEngine } from "../../aws/opensearch";
import { convertCDAToFHIR, isConvertible } from "../../fhir-converter/converter";
import { DocumentReferenceWithId } from "../../fhir/document";
import { getDocumentsFromFHIR } from "../../fhir/document/get-documents";
import { upsertDocumentsToFHIRServer } from "../../fhir/document/save-document-reference";
import { setDocQueryProgress } from "../../hie/set-doc-query-progress";
import { tallyDocQueryProgress } from "../../hie/tally-doc-query-progress";
import { getCQDirectoryEntryOrFail } from "../command/cq-directory/get-cq-directory-entry";
import { Patient } from "@metriport/core/domain/patient";
import { getCwPatientDataOrFail } from "../../commonwell/command/cw-patient-data/get-cw-data";

import { formatDate } from "../shared";
import {
  DocumentReferenceWithMetriportId,
  containsMetriportId,
  containsDuplicateMetriportId,
  cqToFHIR,
  dedupeContainedResources,
} from "./shared";

import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { getCQData } from "../patient";
import { getOutboundDocRetrievalSuccessFailureCount } from "../../hie/carequality-analytics";

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
    const patient = await getPatientOrFail({ id: patientId, cxId: cxId });
    const cqData = getCQData(patient.data.externalData);
    const docRetrievalStartedAt = cqData?.documentRetrievalStartTime;
    const duration = elapsedTimeFromNow(docRetrievalStartedAt);
    const {
      totalCount,
      successCount,
      failureCount,
      noDocumentFoundCount,
      schemaErrorCount,
      httpErrorCount,
      registryErrorCount,
    } = getOutboundDocRetrievalSuccessFailureCount(results);

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
      }
      if (docRetrievalResp.operationOutcome?.issue) {
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

    const seenMetriportIds = new Set<string>();

    let totalErrorCountConvertible = 0;
    let totalAdjustCountConvertible = 0;
    let totalFilteredOutCount = 0;
    let totalDuplicateCount = 0;
    let docRefsDuplicatedInCwCount = 0;
    const cwIdentifierSystems = await getCwIdentifierSystems(patient);

    const resultPromises = await Promise.allSettled(
      results.map(async docRetrievalResp => {
        const docRefs = docRetrievalResp.documentReference;
        if (docRefs) {
          const validDocRefs = docRefs.filter(containsMetriportId);
          totalFilteredOutCount += docRefs.length - validDocRefs.length;

          const deduplicatedDocRefs = validDocRefs.filter(docRef => {
            const isDuplicate = containsDuplicateMetriportId(docRef, seenMetriportIds);

            if (isDuplicate) {
              totalDuplicateCount++;
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

          const docRefsNotDuplicatedInCw: DocumentReferenceWithMetriportId[] = [];
          const docRefsDuplicatedInCw: DocumentReferenceWithMetriportId[] = [];

          deduplicatedDocRefs.forEach(docRef => {
            if (isDocRefDuplicatedInCw(docRef, cwIdentifierSystems)) {
              docRefsDuplicatedInCw.push(docRef);
            } else {
              docRefsNotDuplicatedInCw.push(docRef);
            }
          });

          docRefsDuplicatedInCwCount += docRefsDuplicatedInCw.length;

          await handleDocReferencesDuplicatedInCw({
            docRefs: docRefsDuplicatedInCw,
            requestId,
            patientId,
            cxId,
          });

          const { errorCountConvertible, adjustCountConvertible } = await handleDocReferences(
            docRefsNotDuplicatedInCw,
            requestId,
            patientId,
            cxId,
            docRetrievalResp.gateway.homeCommunityId
          );

          totalErrorCountConvertible += errorCountConvertible;
          totalAdjustCountConvertible += adjustCountConvertible;
        }

        if (docRetrievalResp.operationOutcome) {
          await handleOperationOutcomeIssues({
            issues: docRetrievalResp.operationOutcome.issue,
            requestId,
            patientId,
            cxId,
          });
        }
      })
    );

    totalErrorCountConvertible += totalFilteredOutCount + totalDuplicateCount;
    totalAdjustCountConvertible -= docRefsDuplicatedInCwCount;

    analytics({
      distinctId: cxId,
      event: EventTypes.documentRetrieval,
      properties: {
        requestId,
        patientId,
        hie: MedicalDataSource.CAREQUALITY,
        totalCount,
        successCount,
        failureCount,
        noDocumentFoundCount,
        schemaErrorCount,
        httpErrorCount,
        registryErrorCount,
        docRefsDuplicatedInCwCount,
        duration,
      },
    });

    await setDocQueryProgress({
      patient: { id: patientId, cxId: cxId },
      convertibleDownloadErrors: totalErrorCountConvertible,
      increaseCountConvertible: totalAdjustCountConvertible,
      requestId,
      source: MedicalDataSource.CAREQUALITY,
    });

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

async function handleOperationOutcomeIssues({
  issues,
  requestId,
  patientId,
  cxId,
}: {
  issues: Issue[];
  requestId: string;
  patientId: string;
  cxId: string;
}) {
  const { log } = out(
    `CQ handleOperationOutcomeIssues - requestId ${requestId}, patient ${patientId}`
  );
  const existingFHIRDocRefs: DocumentReference[] = await getDocumentsFromFHIR({
    cxId,
    patientId,
    documentIds: issues.map(issue => issue?.id ?? ""),
  });

  const transactionBundle: Bundle = {
    resourceType: "Bundle",
    type: "transaction",
    entry: [],
  };

  for (const docRef of existingFHIRDocRefs) {
    if (!docRef.id) continue;

    const updatedFHIRDocRef: DocumentReferenceWithId = {
      ...docRef,
      id: docRef.id,
      status: "entered-in-error",
    };

    const transactionEntry: BundleEntry = {
      resource: updatedFHIRDocRef,
      request: {
        method: "PUT",
        url: updatedFHIRDocRef.resourceType + "/" + updatedFHIRDocRef.id,
      },
    };
    transactionBundle.entry?.push(transactionEntry);
  }

  await upsertDocumentsToFHIRServer(cxId, transactionBundle, log);
}

async function handleDocReferencesDuplicatedInCw({
  docRefs,
  requestId,
  patientId,
  cxId,
}: {
  docRefs: DocumentReferenceWithMetriportId[];
  requestId: string;
  patientId: string;
  cxId: string;
}) {
  const { log } = out(
    `CQ handleDocReferencesDuplicatedInCw - requestId ${requestId}, patient ${patientId}`
  );
  const existingFHIRDocRefs: DocumentReference[] = await getDocumentsFromFHIR({
    cxId,
    patientId,
    documentIds: docRefs.map(doc => doc.metriportId ?? ""),
  });

  const transactionBundle: Bundle = {
    resourceType: "Bundle",
    type: "transaction",
    entry: [],
  };

  for (const docRef of existingFHIRDocRefs) {
    if (!docRef.id) continue;

    const updatedFHIRDocRef: DocumentReferenceWithId = {
      ...docRef,
      id: docRef.id,
      docStatus: "final",
      status: "superseded",
    };

    const transactionEntry: BundleEntry = {
      resource: updatedFHIRDocRef,
      request: {
        method: "PUT",
        url: updatedFHIRDocRef.resourceType + "/" + updatedFHIRDocRef.id,
      },
    };
    transactionBundle.entry?.push(transactionEntry);
  }

  await upsertDocumentsToFHIRServer(cxId, transactionBundle, log);
}

async function handleDocReferences(
  docRefs: DocumentReferenceWithMetriportId[],
  requestId: string,
  patientId: string,
  cxId: string,
  cqOrganizationId: string
): Promise<{
  errorCountConvertible: number;
  adjustCountConvertible: number;
}> {
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

  return { errorCountConvertible, adjustCountConvertible };
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

async function getCwIdentifierSystems(patient: Patient): Promise<Set<string>> {
  const existingPatient = await getCwPatientDataOrFail({
    id: patient.id,
    cxId: patient.cxId,
  });

  const cwLinks = existingPatient.data.links ?? [];
  const cwIdentifierSystems = new Set<string>();
  cwLinks.forEach(link => {
    link.patient?.identifier?.forEach(identifier => {
      if (identifier.system) {
        const system = stripUrnPrefix(identifier.system);
        cwIdentifierSystems.add(system);
      }
    });
  });

  return cwIdentifierSystems;
}

function isDocRefDuplicatedInCw(
  docRef: DocumentReferenceWithMetriportId,
  cwIdentifierSystems: Set<string>
): boolean {
  const homeCommunityId = docRef.homeCommunityId;
  const repositoryUniqueId = docRef.repositoryUniqueId;
  return cwIdentifierSystems.has(homeCommunityId) || cwIdentifierSystems.has(repositoryUniqueId);
}
