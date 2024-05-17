import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { capture } from "@metriport/core/util/notifications";
import { out } from "@metriport/core/util/log";
import { IHEGateway } from "@metriport/ihe-gateway-sdk";
import { PurposeOfUse } from "@metriport/shared";
import { errorToString } from "@metriport/shared/common/error";
import z from "zod";
import { isCarequalityEnabled, isCQDirectEnabledForCx } from "../aws/appConfig";
import { getHieInitiator, HieInitiator } from "../hie/get-hie-initiator";
import { makeIheGatewayAPIForPatientDiscovery } from "../ihe-gateway/api";

// TODO: adjust when we support multiple POUs
export function createPurposeOfUse() {
  return PurposeOfUse.TREATMENT;
}

export function isGWValid(gateway: { homeCommunityId: string; url: string }): boolean {
  return !!gateway.homeCommunityId && !!gateway.url;
}

export async function validateCQEnabledAndInitGW({
  cxId,
  forceCq,
  baseLogMsg,
}: {
  cxId: string;
  forceCq: boolean;
  baseLogMsg: string;
}): Promise<IHEGateway | undefined> {
  const { log } = out(baseLogMsg);

  try {
    const iheGateway = makeIheGatewayAPIForPatientDiscovery();
    const isCQEnabled = await isCarequalityEnabled();
    const isCQDirectEnabled = await isCQDirectEnabledForCx(cxId);

    const iheGWNotPresent = !iheGateway;
    const cqIsDisabled = !isCQEnabled && !forceCq;
    const cqDirectIsDisabledForCx = !isCQDirectEnabled;

    if (iheGWNotPresent) {
      log(`IHE GW not available, skipping PD`);
      return undefined;
    } else if (cqIsDisabled) {
      log(`CQ not enabled, skipping PD`);
      return undefined;
    } else if (cqDirectIsDisabledForCx) {
      log(`CQ disabled for cx ${cxId}, skipping PD`);
      return undefined;
    }

    return iheGateway;
  } catch (error) {
    const msg = `Error validating CQ PD enabled`;
    console.error(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        forceCq,
        error,
      },
    });
    return undefined;
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
  parentOrgOid: z.string().optional(),
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

export async function getCqInitiator({
  patient,
  facilityId,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  facilityId?: string;
}): Promise<HieInitiator> {
  return getHieInitiator(patient, facilityId, MedicalDataSource.CAREQUALITY);
}

export function getSystemUserName(orgName: string): string {
  return `${orgName} System User`;
}
