/* eslint-disable @typescript-eslint/no-explicit-any */
import { BundleEntry, DocumentReference, Resource } from "@medplum/fhirtypes";
import {
  docContributionFileParam,
  getDocContributionURL,
} from "@metriport/core/external/commonwell/document/document-contribution";
import { isUploadedByCustomer } from "@metriport/core/external/fhir/shared/index";
import { errorToString } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { Request, Response } from "express";
import { IncomingMessage } from "http";
import { partition } from "lodash";
import { Config } from "../../../shared/config";
import { defaultError, proxyPrefix } from "./shared";

const apiURL = Config.getApiUrl();
const docContributionURL = getDocContributionURL(apiURL);

const context = "processResponse";
export const { log } = out(`${proxyPrefix} ${context}`);

/**
 * Processes the response from the FHIR server before sending it back to CW.
 */
export async function processResponse(
  proxyRes: IncomingMessage, // eslint-disable-line @typescript-eslint/no-unused-vars
  proxyResData: any,
  userReq: Request, // eslint-disable-line @typescript-eslint/no-unused-vars
  userRes: Response // eslint-disable-line @typescript-eslint/no-unused-vars
) {
  const statusCode = proxyRes?.statusCode;
  try {
    if (statusCode != undefined && (statusCode < 200 || statusCode > 299)) {
      throw new Error(`Invalid status code from FHIR server`);
    }
    if (!proxyResData) {
      throw new Error(`Missing proxyResData`);
    }
    const payloadString = proxyResData.toString("utf8");
    if (!payloadString) {
      throw new Error(`Could not convert reponse to string`);
    }
    const payload = JSON.parse(payloadString);
    // Filter out CW data while we don't manage to do it with FHIR query
    if (payload.entry) {
      const { docRefResources, otherResources } = splitResources(payload.entry);
      const docRefs = filterDataForCW(docRefResources);
      const updatedDocRefs = adjustAttachmentURLs(docRefs);
      payload.entry = [...updatedDocRefs, ...otherResources];
      payload.total = payload.entry?.length != null ? payload.entry.length : undefined;
    } else {
      log(`Warn: missing 'entry', not processing the response`);
    }
    // Force not having pagination
    payload.link = undefined;

    const response = JSON.stringify(payload);
    const patientId = userReq?.query["patient.identifier"];
    log(`Responding to CW (patientId ${patientId}): ${response}`);
    return response;
  } catch (error) {
    const msg = `[${proxyPrefix}] Error parsing/transforming response from FHIR server`;
    log(`${msg}: ${errorToString(error)}`);
    capture.error(msg, { extra: { error, proxyResData, statusCode, context } });
    userRes.status(statusCode ?? 500);
    return JSON.stringify(defaultError);
  }
}

function splitResources(entries: BundleEntry<Resource>[]): {
  docRefResources: BundleEntry<DocumentReference>[];
  otherResources: BundleEntry<Resource>[];
} {
  const [docRefResources, otherResources] = partition(
    entries,
    (entry: BundleEntry<Resource>): entry is BundleEntry<DocumentReference> =>
      entry.resource?.resourceType === "DocumentReference"
  );
  return { docRefResources, otherResources };
}

function filterDataForCW(
  entries: BundleEntry<DocumentReference>[]
): BundleEntry<DocumentReference>[] {
  return entries.filter(entry => {
    return entry?.resource ? isUploadedByCustomer(entry.resource) : false;
  });
}

function adjustAttachmentURLs(
  entries: BundleEntry<DocumentReference>[]
): BundleEntry<DocumentReference>[] {
  return entries.map(entry => {
    return {
      ...entry,
      resource: entry.resource
        ? {
            ...entry.resource,
            content: entry.resource?.content?.map(content => {
              return {
                ...content,
                attachment: {
                  ...content.attachment,
                  url: content.attachment?.url
                    ? replaceAttachmentURL(content.attachment.url)
                    : undefined,
                },
              };
            }),
          }
        : undefined,
    };
  });
}

function replaceAttachmentURL(url: string): string {
  const theURL = new URL(url);
  const params = new URLSearchParams();
  params.append(docContributionFileParam, theURL.pathname);
  return `${docContributionURL}?${params.toString()}`;
}
