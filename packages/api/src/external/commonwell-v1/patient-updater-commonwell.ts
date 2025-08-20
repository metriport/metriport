import { PatientUpdater } from "@metriport/core/command/patient-updater";
import { Patient } from "@metriport/core/domain/patient";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getPatients } from "../../command/medical/patient/get-patient";
import { getFacilityOrFail } from "../../command/medical/facility/get-facility";
import { getFacilityIdOrFail } from "../../domain/medical/patient-facility";
import { update } from "./patient";
import { errorToString } from "../../shared/log";
import { capture } from "../../shared/notifications";

const maxNumberOfParallelRequestsToCW = 10;

/**
 * Implementation of the PatientUpdater that executes the logic on CommonWell.
 */
export class PatientUpdaterCommonWell extends PatientUpdater {
  constructor(private readonly orgIdExcludeList: () => Promise<string[]>) {
    super();
    this.orgIdExcludeList = orgIdExcludeList;
  }

  public async updateAll(
    cxId: string,
    patientIds?: string[]
  ): Promise<{ failedUpdateCount: number }> {
    let failedUpdateCount = 0;

    const patients = await getPatients({
      cxId,
      patientIds,
    });
    // Promise that will be executed for each patient
    const updatePatient = async (patient: Patient) => {
      try {
        const facilityId = getFacilityIdOrFail(patient);
        await getFacilityOrFail({ cxId, id: facilityId });
        // WARNING This could overwrite the status for any currently running PD
        // TODO Internal #1832 (rework)
        await update({
          patient,
          facilityId,
          getOrgIdExcludeList: this.orgIdExcludeList,
        });
      } catch (error) {
        failedUpdateCount++;
        const msg = `Failed to update CW patient`;
        console.log(`${msg}. Patient ID: ${patient.id}. Cause: ${errorToString(error)}`);
        capture.message(msg, { extra: { cxId, patientId: patient.id }, level: "error" });
      }
    };
    // Execute the promises in parallel
    await executeAsynchronously(patients, async patient => updatePatient(patient), {
      numberOfParallelExecutions: maxNumberOfParallelRequestsToCW,
    });

    return { failedUpdateCount };
  }
}
