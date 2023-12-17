import {
  Coding,
  DocumentReference,
  DocumentReferenceContent,
  Identifier,
  Reference,
  Resource,
} from "@medplum/fhirtypes";
import {
  Contained,
  Document,
  DocumentContent,
  DocumentIdentifier,
} from "@metriport/commonwell-sdk";
import { difference, groupBy } from "lodash";
import { DeepRequired } from "ts-essentials";
import {
  downloadDocsAndUpsertFHIR,
  queryAndProcessDocuments,
} from "../../../external/commonwell/document/document-query";
import {
  hasCommonwellContent,
  isCommonwellContent,
} from "@metriport/core/external/commonwell/extension";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import { downloadedFromHIEs } from "@metriport/core/external/fhir/shared";
import { isMetriportContent } from "@metriport/core/external/fhir/shared/extensions/metriport";
import { getAllPages } from "../../../external/fhir/shared/paginated";
import { PatientModel } from "../../../models/medical/patient";
import { filterTruthy } from "../../../shared/filter-map-utils";
import { errorToString } from "../../../shared/log";
import { capture } from "@metriport/core/util/notifications";
import { Util } from "../../../shared/util";
import { getDocRefMapping } from "../docref-mapping/get-docref-mapping";
import { appendDocQueryProgress } from "../patient/append-doc-query-progress";
import { getPatientOrFail } from "../patient/get-patient";
import { areDocumentsProcessing } from "./document-status";

export const options = [
  "re-query-doc-refs",
  "force-download",
  "ignore-fhir-conversion-and-upsert",
] as const;
export type Options = (typeof options)[number];

const isReQuery = (options: Options[]): boolean => options.includes("re-query-doc-refs");
const isForceDownload = (options: Options[]): boolean => options.includes("force-download");
const isIgnoreFhirConversionAndUpsert = (options: Options[]): boolean =>
  options.includes("ignore-fhir-conversion-and-upsert");

export const reprocessDocuments = async ({
  cxId,
  documentIds,
  options = [],
  requestId,
}: {
  cxId: string;
  documentIds: string[];
  options?: Options[];
  requestId: string;
}): Promise<void> => {
  const { log } = Util.out(`reprocessDocuments - cxId ${cxId}`);
  documentIds.length
    ? log(`Re-processing documents (${documentIds.length}): ${documentIds.join(", ")}`)
    : log(`Re-processing all documents`);

  // Get documents from FHIR
  const fhir = makeFhirApi(cxId);
  const documentsFromFHIR = await getAllPages(() =>
    fhir.searchResourcePages("DocumentReference", {
      _id: documentIds.join(","),
    })
  );
  // Only use re-download docs we got from CommonWell
  const documentsFromHIEs = documentsFromFHIR.filter(downloadedFromHIEs);
  // We can't re-download existing docs if we don't have CW's url for the Binary/attachment
  const documentsFound =
    !isReQuery(options) && isForceDownload(options)
      ? documentsFromHIEs.filter(hasCommonwellContent)
      : documentsFromHIEs;
  const documents = documentIds.length
    ? documentsFound.filter(d => d.id && documentIds.includes(d.id))
    : documentsFound;
  log(
    `Got ${documentsFromFHIR.length} documentsFromFHIR, ` +
      `${documentsFromHIEs.length} documentsFromHIEs, ` +
      `${documentsFound.length} documentsFound, ` +
      `${documents.length} to process`
  );

  if (documents.length === 0) {
    log(`No documents to process, exiting...`);
    return;
  }

  // Re-download the documents, update them to S3, and re-convert them to FHIR if CCDA
  await downloadDocsAndUpsertFHIRWithDocRefs({
    cxId,
    documents,
    options,
    requestId,
  });

  log(`Done.`);
};

const MISSING_ID = "missing-id";

const getIdFromSubjectId = (subject: Reference | undefined): string | undefined => subject?.id;

function getIdFromSubjectRef(subject: Reference | undefined): string | undefined {
  if (subject?.reference) {
    const reference = subject.reference;
    if (reference.includes("/")) return subject.reference.split("/")[1];
    if (reference.includes("#")) return subject.reference.split("#")[1];
  }
  return undefined;
}

function getPatientId(doc: DocumentReference): string | undefined {
  return getIdFromSubjectId(doc.subject) ?? getIdFromSubjectRef(doc.subject);
}

async function downloadDocsAndUpsertFHIRWithDocRefs({
  cxId,
  documents,
  options,
  requestId,
}: {
  cxId: string;
  documents: DocumentReference[];
  options: Options[];
  requestId: string;
}): Promise<void> {
  // Group docs by Patient
  const docsByPatientId = groupBy(documents, d => getPatientId(d) ?? MISSING_ID);

  for (const [patientId, docs] of Object.entries(docsByPatientId)) {
    if (patientId === MISSING_ID) {
      const docIDs = docs.map(d => d.id);
      const msg = "DocumentReferences with missing patient ID";
      console.log(`${msg} (${docIDs.length}): ${docIDs.join(", ")}`);
      capture.message(msg, { extra: { docIDs }, level: "warning" });
      continue;
    }
    const patient = await getPatientOrFail({ id: patientId, cxId });

    const facilityId = patient.facilityIds[0];
    if (!facilityId) throw new Error(`Patient ${patientId} is missing facilityId`);

    if (isReQuery(options)) {
      await appendDocQueryProgress({
        patient: { id: patient.id, cxId: patient.cxId },
        downloadProgress: { status: "processing" },
        reset: true,
      });
      await queryAndProcessDocuments({
        patient,
        facilityId,
        forceDownload: isForceDownload(options),
        ignoreDocRefOnFHIRServer: true,
        ignoreFhirConversionAndUpsert: isIgnoreFhirConversionAndUpsert(options),
        requestId,
      });
    } else {
      await processDocuments({
        patient,
        docs,
        override: isForceDownload(options),
        ignoreFhirConversionAndUpsert: isIgnoreFhirConversionAndUpsert(options),
        requestId,
      });
    }
  }
}

async function processDocuments({
  patient,
  docs,
  override,
  ignoreFhirConversionAndUpsert,
  requestId,
}: {
  patient: PatientModel;
  docs: DocumentReference[];
  override: boolean;
  ignoreFhirConversionAndUpsert: boolean;
  requestId: string;
}): Promise<void> {
  const { cxId, id: patientId } = patient;
  const { log } = Util.out(`processDocuments - M patientId ${patientId}`);

  if (areDocumentsProcessing(patient)) {
    log(`Patient ${patientId} is already being processed, skipping ${docs.length} docs...`);
    return;
  }

  const docsAsCW: Document[] = await convertDocRefToCW(docs, override);
  if (docsAsCW.length !== docs.length) {
    const idsDocs = docs.map(d => d.id);
    const idsDocsCW = docsAsCW.map(d => d.id);
    const diff = difference(idsDocs, idsDocsCW);
    log(
      `Got ${docs.length} documents but only converted ${docsAsCW.length} to post to FHIR - missing: `,
      diff
    );
  }
  if (docsAsCW.length === 0) return;

  const facilityId = patient.facilityIds[0];
  if (!facilityId) throw new Error(`Patient ${patientId} is missing facilityId`);

  try {
    log(`Processing ${docs.length} documents for patient ${patientId}...`);
    await appendDocQueryProgress({
      patient: { id: patientId, cxId },
      downloadProgress: { status: "processing" },
      reset: true,
    });

    await downloadDocsAndUpsertFHIR({
      patient,
      facilityId,
      documents: docsAsCW,
      forceDownload: override,
      ignoreFhirConversionAndUpsert,
      requestId,
    });
  } catch (error) {
    log(`Error processing docs: ${errorToString(error)}`);
    capture.error(error, {
      extra: { context: `processDocsOfPatient`, error, patientId: patient.id },
    });
  } finally {
    await appendDocQueryProgress({
      patient: { id: patientId, cxId },
      downloadProgress: { status: "completed" },
    });
  }
  log(`Done for patient ${patientId}`);
}

async function convertDocRefToCW(
  docs: DocumentReference[],
  isOverride: boolean
): Promise<Document[]> {
  const converted = await Promise.all(
    docs.map(async d => {
      const emptyMsg = (property: string) => {
        console.log(`Document ${d.id} is missing ${property}, skipping...`);
        return undefined;
      };
      if (!d.id) return emptyMsg("id");
      const docRefMapping = await getDocRefMapping(d.id);
      if (!docRefMapping) {
        console.log(`Document ${d.id} not found on DB, skipping...`);
        return undefined;
      }

      if (!d.content) return emptyMsg("content");
      if (!d.content.length) return emptyMsg("content.length");
      let content: DocumentReferenceContent | undefined = {};
      if (isOverride) {
        // if we want to override we need the CW url
        const cwContent = d.content.filter(isCommonwellContent);
        content = cwContent[0];
        if (!content) return emptyMsg("cwContent");
      } else {
        const metriportContent = d.content.filter(isMetriportContent);
        content = metriportContent[0];
        if (!content) return emptyMsg("cwContent");
      }
      if (!d.type) return emptyMsg("type");
      if (!d.status) return emptyMsg("status");
      if (!d.masterIdentifier) return emptyMsg("masterIdentifier");
      const masterIdValue = d.masterIdentifier.value;
      if (!masterIdValue) return emptyMsg("masterIdentifier.value");
      if (!d.subject) return emptyMsg("subject");
      const subjectReference = d.subject.reference;
      if (!subjectReference) return emptyMsg("subject.reference");
      if (!d.context) return emptyMsg("context");
      try {
        const cwDoc: Document = {
          id: docRefMapping.externalId,
          content: {
            resourceType: "DocumentReference",
            ...(d.contained && {
              contained: d.contained.map(fhirContainedToCW).flatMap(c => c ?? []),
            }),
            ...(d.masterIdentifier && {
              masterIdentifier: {
                ...d.masterIdentifier,
                value: masterIdValue,
              },
            }),
            ...(d.identifier && { identifier: d.identifier.map(fhirIdentifierToCW) }),
            subject: {
              ...d.subject,
              reference: subjectReference,
            },
            ...(d.type && { type: d.type }),
            ...(d.category && { category: d.category }),
            ...(d.author && {
              author: d.author.flatMap(a => (a.reference ? { reference: a.reference } : [])),
            }),
            indexed: d.date ?? d.meta?.lastUpdated ?? new Date().toISOString(),
            status: fhirStatusToCW(d.status),
            description: d.description,
            mimeType: content.attachment?.contentType,
            size: content.attachment?.size,
            hash: content.attachment?.hash,
            location: content.attachment?.url,
            ...(content.format && { format: fhirFormatToCW(content.format) }),
            context: d.context,
            type: {
              coding: d.type.coding,
              text: d.type.text,
            },
          },
        };
        return cwDoc;
      } catch (error) {
        console.log(`[convertDocRefToCW] Error converting docRef ${d.id} to CW: ${error}`);
        capture.error(error, {
          extra: {
            context: `convertDocRefToCW`,
            document: d,
            error,
          },
        });
      }
    })
  );
  return converted.flatMap(filterTruthy);
}

// TODO this should either be removed (and we don't convert doc refs from FHIR to CW), or we
// should make this and caller better match the CW>FHIR conversion
export const fhirContainedToCW = (contained: Resource): Contained | undefined => {
  const base = {
    id: contained.id,
  };
  switch (contained.resourceType) {
    case "Patient":
      return {
        ...base,
        identifier: contained.identifier?.map(fhirIdentifierToCW),
      };
    case "Organization":
      return {
        ...base,
        identifier: contained.identifier?.map(fhirIdentifierToCW),
        name: contained.name,
      };
    case "Practitioner":
      return {
        ...base,
        identifier: contained.identifier?.map(fhirIdentifierToCW),
      };
    default:
      return undefined;
  }
};

export const fhirIdentifierToCW = (id: Identifier): DocumentIdentifier => {
  if (!id.value) throw new Error(`Missing identifier.value`);
  return {
    use: id.use,
    system: id.system,
    value: id.value,
  };
};

export const fhirStatusToCW = (
  status: DeepRequired<DocumentReference>["status"]
): Document["content"]["status"] => {
  return status === "superseded"
    ? "superceded"
    : status === "entered-in-error"
    ? "entered in error"
    : status;
};

export const fhirFormatToCW = (format: Coding): DocumentContent["format"] => {
  return format.system || format.code || format.display;
};
