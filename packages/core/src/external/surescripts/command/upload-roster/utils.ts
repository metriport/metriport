import { BadRequestError, NotFoundError, validateNPI } from "@metriport/shared";
import { OrganizationData } from "@metriport/shared/domain/customer";
import { Patient } from "@metriport/shared/domain/patient";
import { isBackfillRosterType } from "@metriport/shared/interface/external/surescripts/roster";
import { surescriptsSource } from "@metriport/shared/interface/external/surescripts/source";
import { isSurescriptsFeatureFlagEnabledForCx } from "../../../../command/feature-flags/domain-ffs";
import { getLatestRoster } from "../../../../command/roster/api/get-latest-roster";
import { getPatientIdsFromRoster } from "../../../../command/roster/api/get-patient-ids-from-roster";
import { getRoster } from "../../../../command/roster/api/get-roster";
import { updateRoster } from "../../../../command/roster/api/update-roster";
import { executeAsynchronously } from "../../../../util/concurrency";
import { out } from "../../../../util/log";
import { getCustomerData } from "../../api/get-customer";
import { getPatient } from "../../api/get-patient";
import { SurescriptsBatchRequestData, SurescriptsRequesterData } from "../../types";
import { SurescriptsRosterRequest } from "./upload-roster";

/**
 * Closes a Surescripts roster and returns the batch request data.
 *
 * @param rosterType - The type of roster to close.
 * @param cxId - The CX ID of the customer.
 * @param rosterId - The ID of the roster. Optional if the roster is not a single-customer roster.
 */
export async function closeRoster({
  rosterType,
  cxId,
  rosterId: rosterIdParam,
  includeMultipleDemographics = false,
  includeAugmentationDemographics = false,
}: SurescriptsRosterRequest): Promise<SurescriptsBatchRequestData | undefined> {
  const { log } = out(`ss.closeRoster - cxId ${cxId}, rosterType ${rosterType}`);
  if (!isBackfillRosterType(rosterType)) {
    throw new BadRequestError("Notification rosters are not supported", undefined, {
      cxId,
      rosterType,
    });
  }
  const { org, facilityNpiMap } = await getRequesterData(cxId);
  await validateRequester({ cxId, org, facilityNpiMap });
  const rosterId =
    rosterIdParam ??
    (await getLatestRoster({
      cxId,
      source: surescriptsSource,
      type: rosterType,
    }));
  if (!rosterId) {
    log(`No roster found for cxId ${cxId} and type ${rosterType}`);
    return;
  }
  if (rosterIdParam) {
    const roster = await getRoster({ cxId, rosterId });
    if (roster.source !== surescriptsSource || roster.type !== rosterType) {
      throw new BadRequestError("Roster does not match the requested source and type", undefined, {
        cxId,
        rosterId,
        rosterType,
        source: roster.source,
        type: roster.type,
      });
    }
  }
  await updateRoster({ cxId, rosterId, status: "closed" });
  const batchRequestData = await getBatchRequestData({
    cxId,
    rosterId,
    org,
    facilityNpiMap,
    includeMultipleDemographics,
    includeAugmentationDemographics,
  });
  return batchRequestData;
}

async function getBatchRequestData({
  cxId,
  rosterId,
  org,
  facilityNpiMap,
  includeMultipleDemographics,
  includeAugmentationDemographics,
}: {
  cxId: string;
  rosterId: string;
  org: OrganizationData;
  facilityNpiMap: Record<string, string>;
  includeMultipleDemographics: boolean;
  includeAugmentationDemographics: boolean;
}): Promise<SurescriptsBatchRequestData> {
  const patientIds = await getPatientIdsFromRoster({ cxId, rosterId });
  const patients = await getEachPatientById(cxId, patientIds, includeAugmentationDemographics);
  for (const patient of patients) {
    const patientFacility = patient.facilityIds[0];
    if (!patientFacility) {
      throw new NotFoundError("Patient facility not found", undefined, {
        cxId,
        patientId: patient.id,
      });
    }
    if (!(patientFacility in facilityNpiMap)) {
      throw new NotFoundError("Patient facility not found in facility NPI map", undefined, {
        cxId,
        patientId: patient.id,
        patientFacility,
      });
    }
  }
  return {
    cxId,
    org,
    facilityNpiMap,
    patients,
    populationId: rosterId,
    includeMultipleDemographics,
  };
}

async function getRequesterData(cxId: string): Promise<SurescriptsRequesterData> {
  const customer = await getCustomerData(cxId);
  const org = customer.org;
  const facilityNpiMap = customer.facilities.reduce(
    (acc, facility) => ({
      ...acc,
      [facility.id]: facility.npi,
    }),
    {} as Record<string, string>
  );
  return { cxId, org, facilityNpiMap };
}

async function validateRequester(requester: SurescriptsRequesterData): Promise<void> {
  const isSurescriptsEnabled = await isSurescriptsFeatureFlagEnabledForCx(requester.cxId);
  if (!isSurescriptsEnabled) {
    throw new BadRequestError("Surescripts is not enabled for cx", undefined, {
      cxId: requester.cxId,
    });
  }
  if (requester.facilityNpiMap) {
    for (const npiNumber of Object.values(requester.facilityNpiMap)) {
      if (!validateNPI(npiNumber)) {
        throw new BadRequestError("Invalid NPI", undefined, {
          npiNumber,
          cxId: requester.cxId,
        });
      }
    }
  }
}

async function getEachPatientById(
  cxId: string,
  patientIds: string[],
  includeAugmentationDemographics: boolean
): Promise<Patient[]> {
  const patients: Patient[] = [];
  await executeAsynchronously(
    patientIds,
    async patientId => {
      const patient = await getPatient({ cxId, patientId, includeAugmentationDemographics });
      patients.push(patient);
    },
    {
      numberOfParallelExecutions: 10,
    }
  );
  return patients;
}
