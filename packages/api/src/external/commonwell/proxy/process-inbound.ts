import { Request } from "express";
import BadRequestError from "../../../errors/bad-request";
import { getOrgOrFail } from "./get-org-or-fail";
import { binaryResourceName, docReferenceResourceName, log, pathSeparator } from "./shared";

const updateDocumentReferenceQueryString = (params: string): string => {
  const decodedParams = decodeURIComponent(decodeURI(params));
  return (
    decodedParams
      .replace(/patient\.identifier/i, "patient")
      // eslint-disable-next-line no-useless-escape
      .replace(/urn\:oid\:.+\|(2\.[\.\d]+)/g, "$1")
  );
};
const updateQueryString = (path: string, params: string): string | undefined => {
  if (path.toLocaleLowerCase().includes("documentreference")) {
    return updateDocumentReferenceQueryString(params);
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
  log(`ORIGINAL URL: ${req.url}, HEADERS: ${JSON.stringify(req.headers)}`);
  const parts = req.url.split("?");
  const path = parts[0];
  const queryString = parts[1];
  if (!path) throw new BadRequestError(`Missing path`);

  const { updatedPath, updatedQuery, tenant } = await processRequest(path, queryString);

  const updatedURL =
    `/fhir` + (tenant ? `/${tenant}` : "") + updatedPath + (updatedQuery ? "?" + updatedQuery : "");
  log(`UPDATED URL: ${updatedURL}`);
  return updatedURL;
}
