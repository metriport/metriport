import { Coordinates } from "@metriport/core/domain/address";
import { AddressStrict } from "@metriport/core/domain/location-address";
import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { capture } from "@metriport/core/util/notifications";
import { errorToString, PurposeOfUse } from "@metriport/shared";
import z from "zod";
import { getAddressWithCoordinates } from "../../domain/medical/address";
import { Config } from "../../shared/config";
import { isCarequalityEnabled, isCQDirectEnabledForCx } from "../aws/app-config";
import { getHieInitiator, HieInitiator, isHieEnabledToQuery } from "../hie/get-hie-initiator";
// TODO: adjust when we support multiple POUs
export function createPurposeOfUse() {
  return PurposeOfUse.TREATMENT;
}

export async function isCqEnabled(
  patient: Pick<Patient, "id" | "cxId">,
  facilityId: string,
  forceEnabled: boolean,
  log: typeof console.log
): Promise<boolean> {
  const { cxId } = patient;

  try {
    const isCQEnabled = await isCarequalityEnabled();
    const isCQDirectEnabled = await isCQDirectEnabledForCx(cxId);
    const isCqQueryEnabled = await isFacilityEnabledToQueryCQ(facilityId, patient);

    const cqIsDisabled = !isCQEnabled && !forceEnabled;
    const cqDirectIsDisabledForCx = !isCQDirectEnabled;

    if (cqIsDisabled) {
      log(`CQ not enabled, skipping PD`);
      return false;
    } else if (cqDirectIsDisabledForCx) {
      log(`CQ disabled for cx ${cxId}, skipping PD`);
      return false;
    } else if (!isCqQueryEnabled) {
      log(`CQ querying not enabled for facility, skipping PD`);
      return false;
    }
    return true;
  } catch (error) {
    const msg = `Error validating PD enabled`;
    log(`${msg} - ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        forceEnabled,
        error,
      },
    });
  }
  return false;
}

export const cqOrgActiveSchema = z.object({
  active: z.boolean(),
});

export const cqOrgUrlsSchema = z.object({
  urlXCPD: z.string().optional(),
  urlDQ: z.string().optional(),
  urlDR: z.string().optional(),
});
export type CQOrgUrls = z.infer<typeof cqOrgUrlsSchema>;

export function getCqOrgUrls(): CQOrgUrls {
  const cqOrgUrlsString = Config.getCQOrgUrls();
  const urls = cqOrgUrlsString ? cqOrgUrlsSchema.parse(JSON.parse(cqOrgUrlsString)) : {};
  return urls;
}

export type CQOrgDetails = {
  name: string;
  oid: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  lat: string;
  lon: string;
  contactName: string;
  phone: string;
  email: string;
  /** Implementer is Metriport, all other Orgs/Facilities we manage are Connection */
  role: "Implementer" | "Connection";
  active: boolean;
  /** Translates into the `partOf` field in Carequality. Usually either `metriportOid` or `metriportIntermediaryOid` */
  parentOrgOid?: string | undefined;
  /** Gets translated into the DOA extension in Carequality. Only used for OBO facilities. @see https://sequoiaproject.org/SequoiaProjectHealthcareDirectoryImplementationGuide/output/StructureDefinition-DOA.html */
  oboOid?: string | undefined;
};
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

export function buildCqOrgNameForFacility({
  vendorName,
  orgName,
  oboOid,
}: {
  vendorName: string;
  orgName: string;
  oboOid: string | undefined;
}): string {
  if (oboOid) {
    return `${vendorName} - ${orgName} #OBO# ${oboOid}`;
  }

  return `${vendorName} - ${orgName}`;
}

export async function getCqAddress({
  cxId,
  address,
}: {
  cxId: string;
  address: AddressStrict;
}): Promise<{ coordinates: Coordinates; addressLine: string }> {
  const { coordinates } = await getAddressWithCoordinates(address, cxId);
  const addressLine = address.addressLine2
    ? `${address.addressLine1}, ${address.addressLine2}`
    : address.addressLine1;
  return { coordinates, addressLine };
}
