import { Bundle, BundleEntry, DocumentReference, Resource, ResourceType } from "@medplum/fhirtypes";
import {
  docContributionFileParam,
  getDocContributionURL,
} from "@metriport/core/external/commonwell/document/document-contribution";
import { isDocumentReference } from "@metriport/core/external/fhir/document/document-reference";
import { buildBundle } from "@metriport/core/external/fhir/shared/bundle";
import { isUploadedByCustomer } from "@metriport/core/external/fhir/shared/index";
import BadRequestError from "@metriport/core/util/error/bad-request";
import { errorToString } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { Request } from "express";
import { partition } from "lodash";
import { queryToSearchParams } from "../../../routes/helpers/query";
import { Config } from "../../../shared/config";
import { makeFhirApi } from "../../fhir/api/api-factory";
import { getOrgOrFail } from "./get-org-or-fail";
import { proxyPrefix } from "./shared";

const { log } = out(`${proxyPrefix} proxyRequest`);

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
 */
const allowedQueryParams = ["status", "date", "_include", "_summary"];

/**
 * The main function, it will:
 * - get the Patient ID and the Customer ID (based on the Org OID) from the request;
 * - remove invalid parameters;
 * - query the FHIR server (paginated);
 * - return a bundle with the consolidated FHIR Resources.
 */
export async function processRequest(req: Request): Promise<Bundle<Resource>> {
  log(`ORIGINAL URL: ${req.url}`);

  const { cxId, patientId } = await getPatientAndCxFromRequest(req);

  const { resource, count, params } = fromHttpRequestToFHIR(req);

  log(
    `UPDATED resource: ${resource} / cx ${cxId} / patient ${patientId} ` +
      `/ count : ${count}, params: ${params.toString()}`
  );
  const rawResources = await queryFHIRServer({
    resource,
    cxId,
    patientId,
    count,
    additionalParams: params,
  });

  const bundle = prepareBundle(rawResources);

  log(`Responding to CW (cx ${cxId} / patient ${patientId}): ${bundle.entry?.length} resources`);
  return bundle;
}

async function getPatientAndCxFromRequest(
  req: Request
): Promise<{ cxId: string; patientId: string }> {
  const { orgOID, patientId } = getOrgOIDAndPatientId(req);

  const org = await getOrgOrFail(orgOID);
  const cxId = org.cxId;

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
  for (const [param] of searchParams.entries()) {
    if (!allowedQueryParams.includes(param)) searchParams.delete(param);
  }
  if (searchParams.size <= 0) throw new BadRequestError(`Missing query parameters`);
  return searchParams;
}

async function queryFHIRServer({
  resource,
  cxId,
  patientId,
  count,
  additionalParams,
}: {
  resource: ResourceType;
  cxId: string;
  patientId: string;
  count: number | undefined;
  additionalParams: URLSearchParams;
}): Promise<Resource[]> {
  const fhir = makeFhirApi(cxId);

  const params = new URLSearchParams(additionalParams);
  params.append("patient", patientId);
  const paramsStr = params.toString();

  const searchFunction = () => fhir.searchResourcePages(resource, paramsStr);
  const resources = await getPaginatedResources(searchFunction, count, {
    cxId,
    patientId,
    params: paramsStr,
  });
  return resources;
}

async function getPaginatedResources(
  searchFunction: () => AsyncGenerator<Resource[]>,
  count: number | undefined,
  context?: object
): Promise<Resource[]> {
  const resources: Resource[] = [];
  try {
    for await (const page of searchFunction()) {
      resources.push(...page);
      if (count && resources.length >= count) break;
    }
    const maxElements = count ? Math.min(count, resources.length) : resources.length;
    return resources.slice(0, maxElements);
  } catch (error) {
    const msg = "Error getting paginated resources";
    const extra = { returnedResourceCount: resources.length, ...context };
    log(`${msg}: ${errorToString(error)} / ${JSON.stringify(extra)}`);
    capture.message(`[${proxyPrefix}] ${msg}`, { extra: { ...extra, error } });
    return resources;
  }
}

function prepareBundle(resources: Resource[]): Bundle<Resource> {
  const { documentReferences, otherResources } = splitResources(resources);
  const filteredDocRefs = filterDocRefs(documentReferences);
  const updatedDocRefs = adjustAttachmentURLs(filteredDocRefs);
  const consolidatedResources = [...updatedDocRefs, ...otherResources];
  const bundleEntries: BundleEntry[] = consolidatedResources.map(r => ({ resource: r }));
  const bundle = buildBundle(bundleEntries);
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

function filterDocRefs(resources: DocumentReference[]): DocumentReference[] {
  return resources.filter(resource => isUploadedByCustomer(resource));
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
