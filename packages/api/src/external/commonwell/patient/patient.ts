import { isDemoAugEnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import { Patient, PatientExternalData } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { out } from "@metriport/core/util/log";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { createAugmentedPatient } from "../../../domain/medical/patient-demographics";
import {
  registerAndLinkPatientInCwV2,
  removeInCwV2,
  updatePatientAndLinksInCwV2,
} from "../../commonwell-v2/patient/patient";
import { HieInitiator } from "../../hie/get-hie-initiator";
import { LinkStatus } from "../../patient-link";
import { validateCWEnabled } from "../shared";
import { UpdatePatientCmd } from "./command-types";
import { updatePatientDiscoveryStatus } from "./patient-external-data";
import { CQLinkStatus, PatientDataCommonwell } from "./patient-shared";

export function getCWData(
  data: PatientExternalData | undefined
): PatientDataCommonwell | undefined {
  if (!data) return undefined;
  return data[MedicalDataSource.COMMONWELL] as PatientDataCommonwell; // TODO validate the type
}

/**
 * Returns the status of linking the Patient with CommonWell.
 */
export function getLinkStatusCW(data: PatientExternalData | undefined): LinkStatus {
  const defaultStatus: LinkStatus = "processing";
  if (!data) return defaultStatus;
  return getCWData(data)?.status ?? defaultStatus;
}

/**
 * Returns the status of linking the Patient with CommonWell's CareQuality bridge. Used for
 * Enhanced Coverage.
 */
export function getLinkStatusCQ(data: PatientExternalData | undefined): CQLinkStatus {
  const defaultStatus: CQLinkStatus = "unlinked";
  if (!data) return defaultStatus;
  return getCWData(data)?.cqLinkStatus ?? defaultStatus;
}

export async function create({
  patient,
  facilityId,
  getOrgIdExcludeList,
  requestId: inputRequestId,
  forceCWCreate = false,
  rerunPdOnNewDemographics = false,
  initiator,
}: {
  patient: Patient;
  facilityId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  requestId?: string;
  forceCWCreate?: boolean;
  rerunPdOnNewDemographics?: boolean;
  initiator?: HieInitiator;
}): Promise<{ commonwellPatientId: string } | void> {
  const { log, debug } = out(`CW create - M patientId ${patient.id}`);

  const isCwEnabled = await validateCWEnabled({
    patient,
    facilityId,
    forceCW: forceCWCreate,
    log,
  });
  if (!isCwEnabled) return;

  const demoAugEnabled = await isDemoAugEnabledForCx(patient.cxId);
  const cxRerunPdOnNewDemographics = demoAugEnabled || rerunPdOnNewDemographics;

  const requestId = inputRequestId ?? uuidv7();
  const startedAt = new Date();
  const updatedPatient = await updatePatientDiscoveryStatus({
    patient,
    status: "processing",
    params: {
      requestId,
      facilityId,
      startedAt,
      rerunPdOnNewDemographics: cxRerunPdOnNewDemographics,
    },
  });

  return await registerAndLinkPatientInCwV2({
    patient: createAugmentedPatient(updatedPatient),
    facilityId,
    getOrgIdExcludeList,
    rerunPdOnNewDemographics: cxRerunPdOnNewDemographics,
    requestId,
    startedAt,
    debug,
    initiator,
    update,
  });
}

export async function update({
  patient,
  facilityId,
  getOrgIdExcludeList,
  requestId: inputRequestId,
  forceCWUpdate = false,
  rerunPdOnNewDemographics = false,
}: UpdatePatientCmd): Promise<void> {
  const { log, debug } = out(`CW update - M patientId ${patient.id}`);

  const isCwEnabled = await validateCWEnabled({
    patient,
    facilityId,
    forceCW: forceCWUpdate,
    log,
  });
  if (!isCwEnabled) return;

  const demoAugEnabled = await isDemoAugEnabledForCx(patient.cxId);
  const cxRerunPdOnNewDemographics = demoAugEnabled || rerunPdOnNewDemographics;

  const requestId = inputRequestId ?? uuidv7();
  const startedAt = new Date();
  const updatedPatient = await updatePatientDiscoveryStatus({
    patient,
    status: "processing",
    params: {
      requestId,
      facilityId,
      startedAt,
      rerunPdOnNewDemographics: cxRerunPdOnNewDemographics,
    },
  });

  await updatePatientAndLinksInCwV2({
    patient: createAugmentedPatient(updatedPatient),
    facilityId,
    getOrgIdExcludeList,
    rerunPdOnNewDemographics: cxRerunPdOnNewDemographics,
    requestId,
    startedAt,
    debug,
    update,
  });
}

export async function remove({ patient, facilityId }: UpdatePatientCmd): Promise<void> {
  const { log } = out(`CW remove - patientId ${patient.id}`);
  await removeInCwV2(patient, facilityId);
  log(`Removed patient from CW v2`);
}
