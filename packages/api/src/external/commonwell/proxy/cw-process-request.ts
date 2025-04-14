import { Bundle, BundleEntry, DocumentReference, Resource, ResourceType } from "@medplum/fhirtypes";
import {
  docContributionFileParam,
  getDocContributionURL,
} from "@metriport/core/external/commonwell/document/document-contribution";
import { isDocumentReference } from "@metriport/core/external/fhir/document/document-reference";
import { toFHIR as orgToFHIR } from "@metriport/core/external/fhir/organization/conversion";
import { toFHIR as patientToFHIR } from "@metriport/core/external/fhir/patient/conversion";
import { buildBundle } from "@metriport/core/external/fhir/shared/bundle";
import { ensureCcdExists } from "@metriport/core/shareback/ensure-ccd-exists";
import { getMetadataDocumentContents } from "@metriport/core/shareback/metadata/get-metadata-xml";
import { parseExtrinsicObjectXmlToDocumentReference } from "@metriport/core/shareback/metadata/parse-metadata-xml";
import { out } from "@metriport/core/util/log";
import { BadRequestError } from "@metriport/shared";
import dayjs from "dayjs";
import { Request } from "express";
import { partition, uniqBy } from "lodash";
import { getOrganizationOrFail } from "../../../command/medical/organization/get-organization";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { queryToSearchParams } from "../../../routes/helpers/query";
import { Config } from "../../../shared/config";
import { getCxIdFromOidOrFail } from "./get-cxid-from-oid";
import { proxyPrefix } from "./shared";

const apiURL = Config.getApiUrl();
const docContributionURL = getDocContributionURL(apiURL);

/**
 * Trying to minimize the chances of failing to respond b/c of diff params to define the patient.
 */
const patientParams = ["patient.identifier", "patient.id", "patient", "subject", "subject.id"];
const countParam = "_count";
/**
 * CW might send `category` but we've seen it as `('34133-9%5E%5E2.16.840.1.113883.6.1')` which is not valid
 * for the FHIR server, and there's nothing on CW's spec about it, so we're not going to support it for now.
 * CW might also send `_include`, but since we're not using the FHIR server, we will always return DocumentReferences with the subject (Patient) and the contained Organization
 */
const allowedQueryParams = ["status", "date", "_summary"];

/**
 * The main function, it will:
 * - get the Patient ID and the Customer ID (based on the Org OID) from the request;
 * - remove invalid parameters;
 * - query s3 for metadata files;
 * - parse them and create FHIR DocumentReferences for them
 * - return a bundle with the DocumentReferences
 */
export async function processRequest(req: Request): Promise<Bundle<Resource>> {
  const { cxId, patientId } = await getPatientAndCxFromRequest(req);
  const { log } = out(`${proxyPrefix} request - cxId ${cxId}, patient ${patientId}`);
  log(`ORIGINAL URL: ${req.url}`);
  const { resource, count, params } = fromHttpRequestToFHIR(req);

  log(`UPDATED resource: ${resource} / count : ${count} / params: ${params.toString()}`);

  const patient = await getPatientOrFail({ id: patientId, cxId });
  const organization = await getOrganizationOrFail({ cxId });
  const patientResource = patientToFHIR(patient);
  const orgResource = orgToFHIR(organization);
  orgResource.identifier = [
    {
      value: organization.oid,
    },
  ];

  await ensureCcdExists({ cxId, patientId, log });
  const metadataFiles = await getMetadataDocumentContents(cxId, patientId);
  const docRefs: DocumentReference[] = [];
  for (const file of metadataFiles) {
    const additionalDocRef = await parseExtrinsicObjectXmlToDocumentReference(file, patientId);
    additionalDocRef.contained = [orgResource];
    docRefs.push(additionalDocRef);
  }

  const bundle = prepareBundle([patientResource, ...docRefs], params);
  log(
    `Responding to CW (cx ${cxId} / patient ${patientId}): ${
      bundle.entry?.length
    } resources - ${JSON.stringify(bundle)}`
  );
  return bundle;
}

async function getPatientAndCxFromRequest(
  req: Request
): Promise<{ cxId: string; patientId: string }> {
  const { orgOID, patientId } = getOrgOIDAndPatientId(req);

  const { cxId } = await getCxIdFromOidOrFail(orgOID);

  return { cxId, patientId };
}

function getOrgOIDAndPatientId(req: Request): {
  orgOID: string;
  patientId: string;
} {
  const query = req.query;
  const executeWithParam = (paramName: string) => {
    const param = query[paramName];
    if (typeof param !== "string") return undefined;
    const patientIdRaw = param?.split("|") ?? [];
    const orgOID = (patientIdRaw[0] ?? "").replace("urn:oid:", "");
    const patientId = (patientIdRaw[1] ?? "").replace("urn:oid:", "").replace("urn:uuid:", "");
    if (orgOID?.trim().length && patientId?.trim().length) return { orgOID, patientId };
    return undefined;
  };
  for (const param of patientParams) {
    const response = executeWithParam(param);
    if (response) return response;
  }
  throw new BadRequestError(`Could not determine Org OID and Patient ID from query params`);
}

function fromHttpRequestToFHIR(req: Request): {
  resource: ResourceType;
  count: number | undefined;
  params: URLSearchParams;
} {
  const resource = "DocumentReference";
  const searchParams = queryToSearchParams(req.query);
  const countStr = searchParams.get(countParam);
  const count = countStr ? parseInt(countStr) : undefined;
  const params = getAllowedSearchParams(searchParams);
  return { resource, count, params };
}

function getAllowedSearchParams(searchParams: URLSearchParams): URLSearchParams {
  const paramsToUse = new URLSearchParams();
  for (const [param, value] of searchParams.entries()) {
    if (allowedQueryParams.includes(param)) paramsToUse.append(param, value);
  }
  return paramsToUse;
}

export function prepareBundle(resources: Resource[], params: URLSearchParams): Bundle<Resource> {
  const { documentReferences, otherResources } = splitResources(resources);
  const filteredDocRefs = applyFilterParams(documentReferences, params);
  if (filteredDocRefs.length < 1) return buildBundle();

  const updatedDocRefs = adjustAttachmentURLs(filteredDocRefs);
  const consolidatedResources = [...updatedDocRefs, ...otherResources];
  const uniqueResources = uniqBy(consolidatedResources, r => r.id);
  const bundleEntries: BundleEntry[] = uniqueResources.map(r => ({ resource: r }));
  const bundle = buildBundle({ entries: bundleEntries });
  return bundle;
}

function splitResources(entries: Resource[]): {
  documentReferences: DocumentReference[];
  otherResources: Resource[];
} {
  const [documentReferences, otherResources] = partition(
    entries,
    (r: Resource): r is DocumentReference => isDocumentReference(r)
  );
  return { documentReferences, otherResources };
}

function adjustAttachmentURLs(docRefs: DocumentReference[]): DocumentReference[] {
  return docRefs.map(docRef => {
    return {
      ...docRef,
      content: docRef?.content?.map(content => {
        return {
          ...content,
          attachment: {
            ...content.attachment,
            url: content.attachment?.url ? replaceAttachmentURL(content.attachment.url) : undefined,
          },
        };
      }),
    };
  });
}

function replaceAttachmentURL(url: string): string {
  const theURL = new URL(url);
  const params = new URLSearchParams();
  params.append(docContributionFileParam, theURL.pathname);
  return `${docContributionURL}?${params.toString()}`;
}

export function applyFilterParams(
  docRefs: DocumentReference[],
  params: URLSearchParams
): DocumentReference[] {
  const date = params.get("date");
  const countParam = params.get("count");
  const status = params.get("status");

  let filteredDocRefs = docRefs;

  if (date) {
    const match = date.match(/(eq|ne|lt|gt|ge|le|sa|eb|ap)?(.*)/);
    if (match) {
      const [, prefix, dateString] = match;
      const filterDate = dayjs(dateString);

      filteredDocRefs = filteredDocRefs.filter(docRef => {
        const docDate = dayjs(docRef.date);

        switch (prefix) {
          case "eq":
            return docDate.isSame(filterDate);
          case "ne":
            return !docDate.isSame(filterDate);
          case "lt":
            return docDate.isBefore(filterDate);
          case "gt":
            return docDate.isAfter(filterDate);
          case "ge":
            return docDate.isSame(filterDate) || docDate.isAfter(filterDate);
          case "le":
            return docDate.isSame(filterDate) || docDate.isBefore(filterDate);
          case "sa":
            return docDate.isAfter(filterDate);
          case "eb":
            return docDate.isBefore(filterDate);
          default:
            return docDate.isSame(filterDate, "day");
        }
      });
    }
  }

  if (status) {
    filteredDocRefs = filteredDocRefs.filter(doc => doc.status === status);
  }

  if (countParam) {
    const count = parseInt(countParam);
    if (!isNaN(count)) {
      filteredDocRefs = filteredDocRefs.slice(0, count);
    }
  }

  return filteredDocRefs;
}
