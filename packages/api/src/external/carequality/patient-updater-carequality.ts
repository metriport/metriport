import { PatientUpdater } from "@metriport/core/command/patient-updater";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { Patient } from "@metriport/core/domain/patient";
import { getFacilityOrFail } from "../../command/medical/facility/get-facility";
import { getFacilityIdOrFail } from "../../domain/medical/patient-facility";
import cqCommands from ".";
import { errorToString } from "../../shared/log";
import { capture } from "../../shared/notifications";
import { getPatients } from "../../command/medical/patient/get-patient";

const maxNumberOfParallelRequestsToCQ = 10;

/**
 * Implementation of the PatientUpdater that executes the logic on Carequality.
 */
export class PatientUpdaterCarequality extends PatientUpdater {
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
        const facility = await getFacilityOrFail({ cxId, id: facilityId });

        await cqCommands.patient.discover(patient, facility.data.npi);
      } catch (error) {
        failedUpdateCount++;
        const msg = `Failed to update CQ patient`;
        console.log(`${msg}. Patient ID: ${patient.id}. Cause: ${errorToString(error)}`);
        capture.message(msg, { extra: { cxId, patientId: patient.id }, level: "error" });
      }
    };
    // Execute the promises in parallel
    await executeAsynchronously(patients, async patient => updatePatient(patient), {
      numberOfParallelExecutions: maxNumberOfParallelRequestsToCQ,
    });

    return { failedUpdateCount };
  }
}
