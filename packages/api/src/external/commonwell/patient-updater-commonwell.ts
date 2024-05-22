import { PatientUpdater } from "@metriport/core/command/patient-updater";
import { Patient } from "@metriport/core/domain/patient";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import cwCommands from ".";
import { getPatients } from "../../command/medical/patient/get-patient";
import { getFacilityIdOrFail } from "../../domain/medical/patient-facility";
import { errorToString } from "@metriport/shared/common/error";
import { capture } from "@metriport/core/util/notifications";

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
        await cwCommands.patient.update({
          patient,
          facilityId,
          getOrgIdExcludeList: this.orgIdExcludeList,
        });
      } catch (error) {
        failedUpdateCount++;
        const msg = "Failed to update CW patient";
        console.error(`${msg}. Patient ID: ${patient.id}. Cause: ${errorToString(error)}`);
        capture.error(msg, {
          extra: {
            cxId,
            patientId: patient.id,
            error,
          },
        });
      }
    };
    // Execute the promises in parallel
    await executeAsynchronously(patients, async patient => updatePatient(patient), {
      numberOfParallelExecutions: maxNumberOfParallelRequestsToCW,
    });

    return { failedUpdateCount };
  }
}
