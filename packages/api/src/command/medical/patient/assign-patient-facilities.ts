import { BadRequestError } from "@metriport/shared";
import { Patient } from "@metriport/core/domain/patient";
import { uniq } from "lodash";
import { getFacilityOrFail } from "../facility/get-facility";
import { getPatientModelOrFail } from "./get-patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { validateVersionForUpdate } from "../../../models/_default";

export type AssignPatientFacilitiesCmd = {
  cxId: string;
  patientId: string;
  facilityIds: string[];
  eTag?: string;
};

/**
 * Assigns a patient to multiple facilities.
 *
 * @param cmd The command containing patient ID, customer ID, facility IDs, and ETag
 * @returns The updated patient
 */
export async function assignPatientFacilities(cmd: AssignPatientFacilitiesCmd): Promise<Patient> {
  const { cxId, patientId, facilityIds, eTag } = cmd;

  // Validate that all facilities exist and customer has access to them
  await Promise.all(facilityIds.map(facilityId => getFacilityOrFail({ cxId, id: facilityId })));

  return executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientModelOrFail({
      id: patientId,
      cxId,
      lock: true,
      transaction,
    });

    validateVersionForUpdate(patient, eTag);

    const uniqueFacilityIds = uniq(facilityIds);
    if (uniqueFacilityIds.length === 0) {
      throw new BadRequestError("At least one facility ID must be provided");
    }

    const updatedPatient = await patient.update(
      {
        facilityIds: uniqueFacilityIds,
      },
      { transaction }
    );

    return updatedPatient.dataValues;
  });
}
