/* eslint-disable @typescript-eslint/no-explicit-any */
import { DocumentReference } from "@medplum/fhirtypes";
import {
  docContributionFileParam,
  getDocContributionURL,
} from "@metriport/core/external/commonwell/document/document-contribution";
import { isUploadedByCustomer } from "@metriport/core/external/fhir/shared/index";
import { errorToString } from "@metriport/core/util/error/index";
import { capture } from "@metriport/core/util/notifications";
import { Request, Response } from "express";
import { IncomingMessage } from "http";
import { Config } from "../../../shared/config";
import { log } from "./shared";

const apiURL = Config.getApiUrl();
const docContributionURL = getDocContributionURL(apiURL);

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
      payload.entry = filterDataForCW(payload.entry);
      payload.entry = adjustAttachmentURLs(payload.entry);
      payload.total = payload.entry?.length != null ? payload.entry.length : undefined;
    }
    const response = JSON.stringify(payload);
    log(`Responding to CW (cxPatientId ${cxPatientId}): ${response}`);
    return response;
  } catch (error) {
    const msg = "Error parsing/transforming response";
    log(`${msg}: ${errorToString(error)}`);
    capture.error(msg, { extra: { error, proxyResData } });
    throw new Error("Error processing requeest");
  }
}

function filterDataForCW(entries: DocumentReference[]): any {
  return entries.filter((entry: any) => {
    return entry.resource ? isUploadedByCustomer(entry.resource) : false;
  });
}

function adjustAttachmentURLs(entries: DocumentReference[]): any {
  return entries.map(entry => {
    return {
      ...entry,
      content: entry.content
        ? entry.content.map(content => {
            return {
              ...content,
              attachment: content.attachment
                ? {
                    ...content.attachment,
                    url: content.attachment.url
                      ? replaceAttachmentURL(content.attachment.url)
                      : undefined,
                  }
                : undefined,
            };
          })
        : undefined,
    };
  });
}

function replaceAttachmentURL(url: string): any {
  const theURL = new URL(url);
  return `${docContributionURL}?${docContributionFileParam}=${theURL.pathname}`;
}
