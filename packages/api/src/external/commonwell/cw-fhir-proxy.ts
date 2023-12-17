/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import proxy from "express-http-proxy";
import Router from "express-promise-router";
import { IncomingMessage } from "http";
import BadRequestError from "../../errors/bad-request";
import NotFoundError from "../../errors/not-found";
import { asyncHandler } from "../../routes/util";
import { Config } from "../../shared/config";
import { downloadedFromCW } from "@metriport/core/external/fhir/shared";
import { getOrgOrFail } from "./cw-fhir-proxy-helpers";

const fhirServerUrl = Config.getFHIRServerUrl();
const pathSeparator = "/";
const binaryResourceName = "Binary";
const docReferenceResourceName = "DocumentReference";

const dummyRouter = Router();
dummyRouter.all(
  "/*",
  asyncHandler(async () => {
    throw new NotFoundError(`CW FHIR server is disabled`);
  })
);

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

export async function process(path: string, queryString?: string): Promise<MainType> {
  if (path.includes(binaryResourceName)) return processBinary(path, queryString);
  if (path.includes(docReferenceResourceName)) return processDocReference(path, queryString);
  throw new BadRequestError(`Unsupported resource type`);
}

/**
 * Processes the request before sending it the FHIR server.
 */
export async function proxyReqPathResolver(req: Request) {
  console.log(`ORIGINAL HEADERS: `, JSON.stringify(req.headers));
  console.log(`ORIGINAL URL: `, req.url);
  const parts = req.url.split("?");
  const path = parts[0];
  const queryString = parts[1];
  if (!path) throw new BadRequestError(`Missing path`);

  const { updatedPath, updatedQuery, tenant } = await process(path, queryString);

  const updatedURL =
    `/fhir` + (tenant ? `/${tenant}` : "") + updatedPath + (updatedQuery ? "?" + updatedQuery : "");
  console.log(`UPDATED URL: `, updatedURL);
  return updatedURL;
}

/**
 * Processes the response from the FHIR server before sending it back to CW.
 */
export async function userResDecorator(
  proxyRes: IncomingMessage, // eslint-disable-line @typescript-eslint/no-unused-vars
  proxyResData: any,
  userReq: Request, // eslint-disable-line @typescript-eslint/no-unused-vars
  userRes: Response // eslint-disable-line @typescript-eslint/no-unused-vars
) {
  try {
    const payloadString = proxyResData.toString("utf8");
    const updatedPayload = payloadString;
    const payload = JSON.parse(updatedPayload);
    // Filter out CW data while we don't manage to do it with FHIR query
    if (payload.entry) {
      payload.entry = payload.entry.filter((entry: any) => {
        return entry.resource ? !downloadedFromCW(entry.resource) : true;
      });
      payload.total = payload.entry?.length != null ? payload.entry.length : undefined;
    }
    return JSON.stringify(payload);
  } catch (err) {
    console.log(`Error parsing/transforming response: `, err);
    console.log(`RAW, ORIGINAL RESPONSE: `, proxyResData);
    return proxyResData;
  }
}

const router = fhirServerUrl
  ? proxy(fhirServerUrl, {
      proxyReqPathResolver,
      userResDecorator,
    })
  : dummyRouter;

export default router;
