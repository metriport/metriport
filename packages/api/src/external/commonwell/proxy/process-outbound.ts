/* eslint-disable @typescript-eslint/no-explicit-any */
import { BundleEntry, DocumentReference, Resource } from "@medplum/fhirtypes";
import {
  docContributionFileParam,
  getDocContributionURL,
} from "@metriport/core/external/commonwell/document/document-contribution";
import { isUploadedByCustomer } from "@metriport/core/external/fhir/shared/index";
import { errorToString } from "@metriport/core/util/error/shared";
import { capture } from "@metriport/core/util/notifications";
import { Request, Response } from "express";
import { IncomingMessage } from "http";
import { partition } from "lodash";
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
      const { docRefResources, otherResources } = splitResources(payload.entry);
      const docRefs = filterDataForCW(docRefResources);
      const updatedDocRefs = adjustAttachmentURLs(docRefs);
      payload.entry = [...updatedDocRefs, ...otherResources];
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
