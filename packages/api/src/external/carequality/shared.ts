import {
  isCarequalityEnabled,
  isCQDirectEnabledForCx,
  isCqDoaEnabled,
} from "@metriport/core/command/feature-flags/domain-ffs";
import { Coordinates } from "@metriport/core/domain/address";
import { Contact } from "@metriport/core/domain/contact";
import { AddressStrict } from "@metriport/core/domain/location-address";
import { GenderAtBirth, Patient, PatientData } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { capture } from "@metriport/core/util/notifications";
import {
  normalizeEmailNewSafe,
  normalizePhoneNumberSafe,
  PurposeOfUse,
  USStateForAddress,
} from "@metriport/shared";
import { buildDayjs, ISO_DATE } from "@metriport/shared/common/date";
import { errorToString } from "@metriport/shared/common/error";
import z from "zod";
import { getAddressWithCoordinates } from "../../domain/medical/address";
import { Config } from "../../shared/config";
import { getHieInitiator, HieInitiator, isHieEnabledToQuery } from "../hie/get-hie-initiator";
import { CQLink } from "./cq-patient-data";

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

/**
 * Carequality Organization type.
 * - Implementer is the Org that manages the Connections (e.g., Metriport).
 * - Connection is the Org that provides care and/or services to other Connections.
 * @see https://sequoiaproject.org/SequoiaProjectHealthcareDirectoryImplementationGuide/output/ValueSet-OrganizationType.html
 */
export type CqOrgType = "Connection" | "Implementer";

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
  role: CqOrgType;
  active: boolean;
  /** Translates into the `partOf` field in Carequality. Usually either `metriportOid` or `metriportIntermediaryOid` */
  parentOrgOid?: string | undefined;
  /** OID of the principal org this delegate facility acts on behalf of. Used to determine if facility is a delegate. */
  principalOid?: string | undefined;
  /** OIDs of delegate facilities that can act on behalf of this principal. Gets translated into DOA extensions in Carequality. @see https://sequoiaproject.org/SequoiaProjectHealthcareDirectoryImplementationGuide/output/StructureDefinition-DOA.html */
  delegateOids?: string[] | undefined;
};

export type CQOrgDetailsWithUrls = CQOrgDetails & CQOrgUrls;

export async function getCqInitiator(
  patient: Pick<Patient, "id" | "cxId">,
  facilityId?: string
): Promise<HieInitiator> {
  // TODO: ENG-1089 - Remove this once we fully migrate to the new DOA flow on CQ.
  const isCqDoaFeatureFlagEnabled = await isCqDoaEnabled();
  return getHieInitiator(patient, facilityId, isCqDoaFeatureFlagEnabled);
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
}: {
  vendorName: string;
  orgName: string;
}): string {
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

export const cqOrgActiveSchema = z.object({
  active: z.boolean(),
});

export function cqLinkToPatientData(cqLink: CQLink): PatientData {
  const patient = cqLink.patientResource;
  const firstName = patient?.name.map(name => name.given).join(" ") ?? "";
  const lastName = patient?.name.map(name => name.family).join(" ") ?? "";
  const dob = patient?.birthDate ? buildDayjs(patient.birthDate).format(ISO_DATE) : "";
  const genderAtBirth = cqGenderToPatientGender(patient?.gender);
  const address =
    patient?.address?.map(address => ({
      zip: address.postalCode ?? "",
      city: address.city ?? "",
      state: address.state as USStateForAddress,
      country: address.country ?? "",
      addressLine1: address.line?.[0] ?? "",
      addressLine2: address.line?.[1] ?? "",
    })) ?? [];

  const telecom: Contact[] = [];

  if (patient?.telecom) {
    patient.telecom.forEach(tel => {
      const value = tel.value ?? "";

      const normalizedPhone = normalizePhoneNumberSafe(value);
      const normalizedEmail = normalizeEmailNewSafe(value);
      if (normalizedPhone) {
        telecom.push({ phone: normalizedPhone });
      } else if (normalizedEmail) {
        telecom.push({ email: normalizedEmail });
      }
    });
  }

  return {
    firstName,
    lastName,
    dob,
    genderAtBirth,
    address,
    contact: telecom,
  };
}

export function cqGenderToPatientGender(gender: string | undefined): GenderAtBirth {
  if (gender === "male") return "M";
  if (gender === "female") return "F";
  return "U";
}
