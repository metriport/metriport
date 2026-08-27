import { Bundle, BundleEntry, DocumentReference, Resource } from "@medplum/fhirtypes";
import { ingestIntoSearchEngine } from "@metriport/core/command/consolidated/search/document-reference/ingest";
import { createPatientStateConversion } from "@metriport/core/command/patient-state/conversion/create";
import { failPatientStateDr } from "@metriport/core/command/patient-state/dr/fail";
import { MedicalDataSource } from "@metriport/core/external";
import { ehexExtension } from "@metriport/core/external/ehex/extension";
import { getDocuments } from "@metriport/core/external/fhir/document/get-documents";
import { capture, out } from "@metriport/core/util";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { errorToString, processAsyncError } from "@metriport/core/util/error/shared";
import { convertCDAToFHIR, isConvertible } from "../../fhir-converter/converter";
import { DocumentReferenceWithId } from "../../fhir/document";
import { upsertDocumentsToFHIRServer } from "../../fhir/document/save-document-reference";
import { dedupeContainedResources, iheToFhirDocumentReference } from "../../ihe-shared/ihe-to-fhir";
import { formatDate } from "../../ihe-shared/utils";
import { getEhexDirectoryEntryOrFail } from "../command/directory/get-ehex-directory-entry";
import { OutboundEhexDocRetrievalRespParam } from "../gateway-result";
import {
  containsDuplicateMetriportId,
  containsMetriportId,
  DocumentReferenceWithMetriportId,
} from "./shared";

export async function completeOutboundDr({
  requestId,
  patientId,
  cxId,
  results,
  forceDownload,
}: OutboundEhexDocRetrievalRespParam): Promise<void> {
  const { log } = out(
    `eHex processOutboundDocumentRetrievalResps - requestId ${requestId}, patient ${patientId}`
  );
  try {
    log(`${results.length} dr results to process...`);

    // TODO: 1665 - Add analytics
    if (results.length === 0) {
      await createPatientStateConversion({
        patientId,
        cxId,
        network: MedicalDataSource.EHEX,
        params: {
          requestId,
          totalToConvert: 0,
        },
      });

      const msg = `Received DR result without entries.`;
      log(`${msg}`);
      capture.message(msg, {
        extra: {
          context: `ehex.processOutboundDocumentRetrievalResps`,
          patientId: patientId,
          requestId,
          cxId,
          results,
        },
        level: "warning",
      });

      return;
    }

    const seenMetriportIds = new Set<string>();

    // Collect all docRefs with their organization IDs first
    const docRefsByOrganization = new Map<
      string,
      { docRefs: DocumentReferenceWithMetriportId[]; organizationId: string }
    >();

    for (const docRetrievalResp of results) {
      const docRefs = docRetrievalResp.documentReference;
      if (!docRefs) continue;

      const validDocRefs = docRefs.filter(containsMetriportId);
      const organizationId = docRetrievalResp.gateway.homeCommunityId;

      for (const docRef of validDocRefs) {
        const isDuplicate = containsDuplicateMetriportId(docRef, seenMetriportIds);
        if (isDuplicate) {
          capture.message(`Duplicate docRef found in DR Resp`, {
            extra: {
              context: `ehex.processOutboundDocumentRetrievalResps`,
              patientId,
              requestId,
              cxId,
              docRef,
            },
            level: "warning",
          });
          continue;
        }

        const existing = docRefsByOrganization.get(organizationId);
        if (existing) {
          existing.docRefs.push(docRef);
        } else {
          docRefsByOrganization.set(organizationId, {
            docRefs: [docRef],
            organizationId,
          });
        }
      }
    }

    // Calculate totalToConvert across all docRefs
    const allDocRefs = Array.from(docRefsByOrganization.values()).flatMap(group => group.docRefs);
    const totalToConvert = allDocRefs.filter(docRef =>
      isDocumentConvertible(docRef, forceDownload)
    ).length;

    await createPatientStateConversion({
      patientId,
      cxId,
      network: MedicalDataSource.EHEX,
      params: {
        requestId,
        totalToConvert,
      },
    });

    // Process docRefs grouped by organization
    const resultPromises = await Promise.allSettled(
      Array.from(docRefsByOrganization.values()).map(async group =>
        handleDocReferences({
          docRefs: group.docRefs,
          requestId,
          patientId,
          cxId,
          ehexOrganizationId: group.organizationId,
          forceDownload,
        })
      )
    );

    const failed = resultPromises.flatMap(p => (p.status === "rejected" ? p.reason : []));

    if (failed.length > 0) {
      const msg = `Failed to handle doc references in eHex`;
      log(`${msg}`);

      capture.message(msg, {
        extra: {
          context: `ehex.handleDocReferences`,
          patientId: patientId,
          requestId,
          cxId,
        },
        level: "error",
      });
    }
  } catch (error) {
    const msg = `Failed to process documents in eHex.`;
    log(`${msg}. Error: ${errorToString(error)}`);

    await failPatientStateDr({
      patientId,
      cxId,
      network: MedicalDataSource.EHEX,
      requestId,
      reason: errorToString(error),
    });

    capture.message(msg, {
      extra: {
        context: `ehex.processOutboundDocumentRetrievalResps`,
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
  ehexOrganizationId,
  forceDownload,
}: {
  docRefs: DocumentReferenceWithMetriportId[];
  requestId: string;
  patientId: string;
  cxId: string;
  ehexOrganizationId: string;
  forceDownload: boolean;
}) {
  const { log } = out(`eHex handleDocReferences - requestId ${requestId}, M patient ${patientId}`);

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

  const ehexOrganization = await getEhexDirectoryEntryOrFail(ehexOrganizationId);

  for (const docRef of docRefs) {
    try {
      const shouldConvert = isDocumentConvertible(docRef, forceDownload);
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
          document: { id: docRef.metriportId ?? "" },
          s3FileName: docPath,
          s3BucketName: docLocation,
          requestId,
          source: MedicalDataSource.EHEX,
        });
      }

      const draftFHIRDocRef = existingFHIRDocRefs.find(
        fhirDocRef => fhirDocRef.id === docRef.metriportId
      );

      const fhirDocRef = iheToFhirDocumentReference({
        docId: docRef.metriportId,
        docRef,
        docStatus: "final",
        patientId,
        source: MedicalDataSource.EHEX,
        contentExtension: ehexExtension,
        orgName: ehexOrganization.name,
      });
      const mergedFHIRDocRef: DocumentReferenceWithId = {
        ...fhirDocRef,
        description: fhirDocRef.description ?? draftFHIRDocRef?.description,
        content: [...(draftFHIRDocRef?.content ?? []), ...(fhirDocRef.content ?? [])],
        contained: combineAndDedupeContainedResources(draftFHIRDocRef, fhirDocRef),
        date: fhirDocRef.date ?? formatDate(draftFHIRDocRef?.date),
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

      ingestIntoSearchEngine(
        { id: patientId, cxId },
        mergedFHIRDocRef.id,
        file,
        requestId,
        log
      ).catch(processAsyncError("ehex.ingestIntoSearchEngine"));
    } catch (error) {
      const msg = `Error handling doc reference`;
      const extra = {
        context: "ehex.handleDocReferences",
        patientId,
        requestId,
        cxId,
        docRef,
      };
      log(`${msg}: ${errorToString(error)}, ${JSON.stringify(extra)}`);
      capture.error(msg, {
        extra: { ...extra, error: errorToString(error) },
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

function isDocumentConvertible(
  docRef: DocumentReferenceWithMetriportId,
  forceDownload: boolean
): boolean {
  const isDocConvertible = isConvertible(docRef.contentType || undefined);
  return isDocConvertible && (docRef.isNew || forceDownload);
}
