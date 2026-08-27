import {
  isEhexEnabled as isEhexEnabledFF,
  isEhexEnabledForCx,
} from "@metriport/core/command/feature-flags/domain-ffs";
import { Contact } from "@metriport/core/domain/contact";
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
import { Config } from "../../shared/config";
import { getHieInitiator, HieInitiator, isHieEnabledToQuery } from "../hie/get-hie-initiator";
import { EhexLink } from "./ehex-patient-data";

// TODO ENG-1601 Duplicate of cqOrgUrlsSchema on packages/core, remove this one and keep the one in packages/core.
export const ehexOrgUrlsSchema = z.object({
  urlXcpd: z.string().optional(),
  urlDq: z.string().optional(),
  urlDr: z.string().optional(),
});
// TODO ENG-1601 Duplicate of cqOrgUrlsSchema on packages/core, remove this one and keep the one in packages/core.
export type EhexOrgUrls = z.infer<typeof ehexOrgUrlsSchema>;

/**
 * Ehex Organization type.
 * - Implementer is the Org that manages the Connections (e.g., Metriport).
 * - Connection is the Org that provides care and/or services to other Connections.
 * @see https://sequoiaproject.org/SequoiaProjectHealthcareDirectoryImplementationGuide/output/ValueSet-OrganizationType.html
 */
export type EhexOrgType = "Connection" | "Implementer";

export type EhexOrgDetails = {
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
  role: EhexOrgType;
  active: boolean;
  /** Translates into the `partOf` field in Ehex. Usually either `metriportOid` or `metriportIntermediaryOid` */
  parentOrgOid?: string | undefined;
  /** Gets translated into the DOA extension in Ehex. Only used for delegate facilities. @see https://sequoiaproject.org/SequoiaProjectHealthcareDirectoryImplementationGuide/output/StructureDefinition-DOA.html */
  principalOid?: string | undefined;
};

export type EhexOrgDetailsWithUrls = EhexOrgDetails & EhexOrgUrls;

export function createPurposeOfUse() {
  return PurposeOfUse.TREATMENT;
}

export async function isEhexEnabled(
  patient: Pick<Patient, "id" | "cxId">,
  facilityId: string,
  forceEnabled: boolean,
  log: typeof console.log
): Promise<boolean> {
  const { cxId } = patient;

  try {
    const isEhexEnabledValue = await isEhexEnabledFF();
    const isEhexEnabledForCxValue = await isEhexEnabledForCx(cxId);
    const isEhexQueryEnabled = await isFacilityEnabledToQueryEhex(facilityId, patient);

    const ehexIsDisabled = !isEhexEnabledValue && !forceEnabled;
    const isEhexDisabledForCx = !isEhexEnabledForCxValue;

    if (ehexIsDisabled) {
      log(`Ehex not enabled, skipping PD`);
      return false;
    } else if (isEhexDisabledForCx) {
      log(`Ehex disabled for cx ${cxId}, skipping PD`);
      return false;
    } else if (!isEhexQueryEnabled) {
      log(`Ehex querying not enabled for facility, skipping PD`);
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
        error: errorToString(error),
      },
    });
  }
  return false;
}

export async function isFacilityEnabledToQueryEhex(
  facilityId: string | undefined,
  patient: Pick<Patient, "id" | "cxId">
): Promise<boolean> {
  return await isHieEnabledToQuery(facilityId, patient, MedicalDataSource.EHEX);
}

export function getEhexOrgUrls(): EhexOrgUrls {
  const ehexOrgUrlsString = Config.getEhexOrgUrls();
  const urls = ehexOrgUrlsString ? ehexOrgUrlsSchema.parse(JSON.parse(ehexOrgUrlsString)) : {};
  return urls;
}

export function getEhexSystemUserName(orgName: string): string {
  return `${orgName} System User`;
}

export function buildLinkOrgNameForFacility({
  vendorName,
  orgName,
}: {
  vendorName: string;
  orgName: string;
}): string {
  return `${vendorName} - ${orgName}`;
}

export async function getEhexInitiator(
  patient: Pick<Patient, "id" | "cxId">,
  facilityId?: string
): Promise<HieInitiator> {
  return getHieInitiator(patient, facilityId);
}

export const ehexOrgActiveSchema = z.object({
  active: z.boolean(),
});

export function ehexLinkToPatientData(link: EhexLink): PatientData {
  const patient = link.patientResource;
  const primaryName = patient?.name?.[0];
  const firstName = primaryName?.given?.join(" ") ?? "";
  const lastName = primaryName?.family ?? "";
  const dob = patient?.birthDate ? buildDayjs(patient.birthDate).format(ISO_DATE) : "";
  const genderAtBirth = ehexGenderToPatientGender(patient?.gender);
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

export function ehexGenderToPatientGender(gender: string | undefined): GenderAtBirth {
  if (gender === "male") return "M";
  if (gender === "female") return "F";
  return "U";
}
