import { PatientUpdater } from "@metriport/core/domain/patient/patient-updater";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { Patient } from "../../domain/medical/patient";
import { getFacilityIdOrFail } from "../../domain/medical/patient-facility";
import cwCommands from ".";
import { errorToString } from "../../shared/log";
import { capture } from "../../shared/notifications";
import { getPatients } from "../../command/medical/patient/get-patient";

/**
 * Implementation of the PatientUpdater that executes the logic on CommonWell.
 */
export class PatientUpdaterCommonWell extends PatientUpdater {
  public async updateAll(
    cxId: string,
    patientIds: string[]
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
        await cwCommands.patient.update(patient, facilityId);
      } catch (error) {
        failedUpdateCount++;
        console.log(`Failed to update patient ${patient.id} - ${errorToString(error)}`);
        capture.error(error, { extra: { cxId, patientId: patient.id } });
      }
    };
    // Execute the promises in parallel
    await executeAsynchronously(patients, async patient => updatePatient(patient), {
      numberOfParallelExecutions: 10,
    });

    return { failedUpdateCount };
  }
}
