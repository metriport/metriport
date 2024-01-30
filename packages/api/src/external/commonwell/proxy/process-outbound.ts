/* eslint-disable @typescript-eslint/no-explicit-any */
import { downloadedFromCW } from "@metriport/core/external/fhir/shared/index";
import { Request, Response } from "express";
import { IncomingMessage } from "http";
import { log } from "./shared";

/**
 * Processes the response from the FHIR server before sending it back to CW.
 */
export async function processResponse(
  proxyRes: IncomingMessage, // eslint-disable-line @typescript-eslint/no-unused-vars
  proxyResData: any,
  userReq: Request, // eslint-disable-line @typescript-eslint/no-unused-vars
  userRes: Response // eslint-disable-line @typescript-eslint/no-unused-vars
) {
  try {
    const cxPatientId = userReq?.query["patient.identifier"];
    const payloadString = proxyResData.toString("utf8");
    const payload = JSON.parse(payloadString);
    // Filter out CW data while we don't manage to do it with FHIR query
    if (payload.entry) {
      payload.entry = payload.entry.filter((entry: any) => {
        return entry.resource ? !downloadedFromCW(entry.resource) : true;
      });
      payload.total = payload.entry?.length != null ? payload.entry.length : undefined;
    }
    const response = JSON.stringify(payload);
    log(`Responding to CW (cxPatientId ${cxPatientId}): ${response}`);
    return response;
  } catch (err) {
    log(`Error parsing/transforming response: `, err);
    log(`RAW, ORIGINAL RESPONSE: `, proxyResData);
    return proxyResData;
  }
}
