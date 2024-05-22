import { Patient } from "@metriport/core/domain/patient";
import { capture } from "@metriport/core/util/notifications";
import { IHEGateway } from "@metriport/ihe-gateway-sdk";
import { PurposeOfUse } from "@metriport/shared";
import { MedicalDataSource } from "@metriport/core/external/index";
import { errorToString } from "@metriport/shared/common/error";
import z from "zod";
import { isCarequalityEnabled, isCQDirectEnabledForCx } from "../aws/appConfig";
import { getHieInitiator, HieInitiator, isHieEnabledToQuery } from "../hie/get-hie-initiator";
import { makeIheGatewayAPIForPatientDiscovery } from "../ihe-gateway/api";

// TODO: adjust when we support multiple POUs
export function createPurposeOfUse() {
  return PurposeOfUse.TREATMENT;
}

export function isGWValid(gateway: { homeCommunityId: string; url: string }): boolean {
  return !!gateway.homeCommunityId && !!gateway.url;
}

export async function validateCQEnabledAndInitGW({
  patient,
  facilityId,
  forceCq,
  log,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  facilityId: string;
  forceCq: boolean;
  log: typeof console.log;
}): Promise<IHEGateway | undefined> {
  const { cxId } = patient;

  try {
    const iheGateway = makeIheGatewayAPIForPatientDiscovery();
    const isCQEnabled = await isCarequalityEnabled();
    const isCQDirectEnabled = await isCQDirectEnabledForCx(cxId);
    const isCqQueryEnabled = await isFacilityEnabledToQueryCQ(facilityId, patient);

    const iheGWNotPresent = !iheGateway;
    const cqIsDisabled = !isCQEnabled && !forceCq;
    const cqDirectIsDisabledForCx = !isCQDirectEnabled;

    if (iheGWNotPresent) {
      log(`IHE GW not available, skipping PD`);
      return undefined;
    } else if (cqIsDisabled) {
      log(` CQ not enabled, skipping PD`);
      return undefined;
    } else if (cqDirectIsDisabledForCx) {
      log(`CQ disabled for cx ${cxId}, skipping PD`);
      return undefined;
    } else if (!isCqQueryEnabled) {
      log(`CQ querying not enabled for facility, skipping PD`);
      return undefined;
    }

    return iheGateway;
  } catch (error) {
    const msg = `Error validating CQ PD enabled`;
    log(`${msg} - ${errorToString(error)}`);
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

export async function getCqInitiator(
  patient: Pick<Patient, "id" | "cxId">,
  facilityId?: string
): Promise<HieInitiator> {
  return getHieInitiator(patient, facilityId);
}

export async function isFacilityEnabledToQueryCQ(
  facilityId: string | undefined,
  patient: Pick<Patient, "id" | "cxId">
): Promise<boolean> {
  return await isHieEnabledToQuery(facilityId, patient, MedicalDataSource.CAREQUALITY);
}

export function getSystemUserName(orgName: string): string {
  return `${orgName} System User`;
}

export function buildCqOrgName({
  vendorName,
  orgName,
  isProvider,
  oboOid,
}: {
  vendorName: string;
  orgName: string;
  isProvider: boolean;
  oboOid?: string;
}): string {
  if (oboOid && !isProvider) {
    return `${vendorName} - ${orgName} #OBO# ${oboOid}`;
  }

  return `${vendorName} - ${orgName}`;
}
