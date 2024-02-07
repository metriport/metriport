import { out } from "@metriport/core/util/log";
import { Request } from "express";
import BadRequestError from "../../../errors/bad-request";
import { getOrgOrFail } from "./get-org-or-fail";
import { binaryResourceName, docReferenceResourceName, pathSeparator, proxyPrefix } from "./shared";

export const { log } = out(`${proxyPrefix} proxyRequest`);

const maxDocRefsToInclude = 500;

const countParamName = "_count";

const allowedQueryParams = [
  "_include",
  "patient",
  "patient.identifier",
  "status",
  "subject",
  "subject.id",
];

const updatePatientOnQueryString = (params: string): string => {
  const decodedParams = decodeURIComponent(decodeURI(params));
  return (
    decodedParams
      .replace(/patient\.identifier/i, "patient")
      // eslint-disable-next-line no-useless-escape
      .replace(/urn\:oid\:.+\|(2\.[\.\d]+)/g, "$1")
  );
};
const updateQueryString = (path: string, queryString: string): string | undefined => {
  if (path.toLocaleLowerCase().includes("documentreference")) {
    const updatedQueryString = updatePatientOnQueryString(queryString);

    const urlParams = new URLSearchParams(updatedQueryString);
    urlParams.delete(countParamName);
    urlParams.append(countParamName, maxDocRefsToInclude.toString());

    return urlParams.toString();
  }
  return undefined;
};

type MainType = { updatedPath: string; updatedQuery: string | undefined; tenant: string };

export function processBinary(path: string, queryString?: string): MainType {
  const pathItems = path.split(pathSeparator);
  const pos = pathItems.indexOf(binaryResourceName);
  const updatedPath = pathSeparator + pathItems.slice(pos).join(pathSeparator);
  const updatedQuery = queryString;
  const tenant = pos > 0 ? pathItems[pos - 1] ?? "" : "";
  return { updatedPath, updatedQuery, tenant };
}

export async function processDocReference(path: string, queryString?: string): Promise<MainType> {
  if (!queryString) throw new BadRequestError(`Missing query string`);
  const queryParams = new URLSearchParams(queryString);
  const patientIdRaw = queryParams.get("patient.identifier")?.split("|") ?? [];
  const orgOID = (patientIdRaw[0] ?? "").replace("urn:oid:", "");
  const patientId = (patientIdRaw[1] ?? "").replace("urn:oid:", "").replace("urn:uuid:", "");
  const org = await getOrgOrFail(orgOID);
  const tenant = org.cxId;
  queryParams.set("patient.identifier", patientId);
  const updatedQuery = queryParams ? updateQueryString(path, queryParams.toString()) : undefined;
  return { updatedPath: path, updatedQuery, tenant };
}

async function processRequest(path: string, queryString?: string): Promise<MainType> {
  if (path.includes(binaryResourceName)) return processBinary(path, queryString);
  if (path.includes(docReferenceResourceName)) return processDocReference(path, queryString);
  throw new BadRequestError(`Unsupported resource type`);
}

/**
 * Processes the request before sending it the FHIR server.
 */
export async function proxyRequest(req: Request) {
  log(`HEADERS: ${JSON.stringify(req.headers)}`);
  log(`ORIGINAL URL: ${req.url}`);
  const { path, queryString } = splitRequest(req);
  if (!path) throw new BadRequestError(`Missing path`);
  const processedQueryString = processQueryString(queryString);

  const { updatedPath, updatedQuery, tenant } = await processRequest(path, processedQueryString);

  const updatedURL =
    `/fhir` + (tenant ? `/${tenant}` : "") + updatedPath + (updatedQuery ? "?" + updatedQuery : "");
  log(`UPDATED URL: ${updatedURL}`);
  return updatedURL;
}

function splitRequest(req: Request): { path: string | undefined; queryString: string | undefined } {
  const parts = req.url.split("?");
  const path = parts[0];
  const queryString = parts[1];
  return { path, queryString };
}

function processQueryString(queryString: string | undefined): string | undefined {
  if (!queryString) return undefined;
  const urlParams = new URLSearchParams(queryString);
  for (const [param] of urlParams.entries()) {
    if (!allowedQueryParams.includes(param)) urlParams.delete(param);
  }
  return urlParams.toString();
}
