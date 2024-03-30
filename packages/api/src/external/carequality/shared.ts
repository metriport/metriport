import { PurposeOfUse } from "@metriport/shared";
import z from "zod";
import { IHEGateway } from "@metriport/ihe-gateway-sdk";
import { isCQDirectEnabledForCx } from "../aws/appConfig";
import { makeIheGatewayAPIForPatientDiscovery } from "../ihe-gateway/api";
import { isCarequalityEnabled } from "../aws/appConfig";
import { errorToString } from "@metriport/shared/common/error";
import { capture } from "@metriport/core/util/notifications";

// TODO: adjust when we support multiple POUs
export function createPurposeOfUse() {
  return PurposeOfUse.TREATMENT;
}

export function isGWValid(gateway: { homeCommunityId: string; url: string }): boolean {
  return !!gateway.homeCommunityId && !!gateway.url;
}

export async function validateCQEnabledAndInitGW(
  cxId: string,
  forceEnabled: boolean,
  outerLog: typeof console.log
): Promise<IHEGateway | undefined> {
  try {
    const iheGateway = makeIheGatewayAPIForPatientDiscovery();
    const isCQEnabled = await isCarequalityEnabled();
    const isCQDirectEnabled = await isCQDirectEnabledForCx(cxId);

    const iheGWNotPresent = !iheGateway;
    const cqIsDisabled = !isCQEnabled && !forceEnabled;
    const cqDirectIsDisabledForCx = !isCQDirectEnabled;

    if (iheGWNotPresent) {
      outerLog(`IHE GW not available, skipping PD`);
      return undefined;
    } else if (cqIsDisabled) {
      outerLog(`CQ not enabled, skipping PD`);
      return undefined;
    } else if (cqDirectIsDisabledForCx) {
      outerLog(`CQ disabled for cx ${cxId}, skipping PD`);
      return undefined;
    }

    return iheGateway;
  } catch (error) {
    const msg = `Error validating PD enabled`;
    outerLog(`${msg} - ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        forceEnabled,
        error,
      },
    });
  }
}

export const cqOrgUrlsSchema = z.object({
  urlXCPD: z.string().optional(),
  urlDQ: z.string().optional(),
  urlDR: z.string().optional(),
});

export type CQOrgUrls = z.infer<typeof cqOrgUrlsSchema>;

export const cqOrgDetailsSchema = z.object({
  name: z.string(),
  oid: z.string(),
  addressLine1: z.string(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  lat: z.string(),
  lon: z.string(),
  contactName: z.string(),
  phone: z.string(),
  email: z.string(),
  role: z.enum(["Implementer", "Connection"]),
  hostOrgOID: z.string().optional(),
});

export type CQOrgDetails = z.infer<typeof cqOrgDetailsSchema>;
export type CQOrgDetailsWithUrls = CQOrgDetails & CQOrgUrls;

export function formatDate(dateString: string | undefined): string | undefined {
  if (!dateString) return undefined;
  const preprocessedDate = dateString.replace(/[-:]/g, "");
  const year = preprocessedDate.slice(0, 4);
  const month = preprocessedDate.slice(4, 6);
  const day = preprocessedDate.slice(6, 8);
  const formattedDate = `${year}-${month}-${day}`;

  try {
    const date = new Date(formattedDate);
    return date.toISOString();
  } catch (error) {
    const msg = "Error creating date object for document reference";
    console.log(`${msg}: ${error}`);
  }

  return undefined;
}
