import { PatientUpdater } from "@metriport/core/command/patient-updater";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { Patient } from "@metriport/core/domain/patient";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import {
  checkIfRaceIsComplete,
  RaceControl,
  controlDuration,
} from "@metriport/core/util/race-control";
import { getFacilityOrFail } from "../../command/medical/facility/get-facility";
import { getFacilityIdOrFail } from "../../domain/medical/patient-facility";
import cqCommands from ".";
import { errorToString } from "../../shared/log";
import { capture } from "../../shared/notifications";
import { getPatients, getPatient } from "../../command/medical/patient/get-patient";
import { PatientDataCarequality } from "./patient-shared";

dayjs.extend(duration);

const maxNumberOfParallelRequestsToCQ = 10;
const CONTROL_TIMEOUT = dayjs.duration({ minutes: 15 });
const CHECK_DB_INTERVAL = dayjs.duration({ seconds: 60 });

/**
 * Implementation of the PatientUpdater that executes the logic on Carequality.
 */
export class PatientUpdaterCarequality extends PatientUpdater {
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
        const facility = await getFacilityOrFail({ cxId, id: facilityId });

        await cqCommands.patient.discover(patient, facility.data.npi);
        await this.isPatientDiscoveryComplete(patient);
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

  private async isPatientDiscoveryComplete(patient: Patient): Promise<boolean> {
    const raceControl: RaceControl = { isRaceInProgress: true };

    try {
      const successMessage = "CQ discovery polling status complete";
      const timeoutMessage = "CQ discovery polling status reached timeout";

      const raceResult = await Promise.race([
        controlDuration(CONTROL_TIMEOUT.asMilliseconds(), timeoutMessage),
        checkIfRaceIsComplete(
          () => this.getPatientDiscoveryStatus(patient),
          raceControl,
          successMessage,
          CHECK_DB_INTERVAL.asMilliseconds()
        ),
      ]);

      if (raceResult === successMessage) {
        console.log(`CQ discovery polling status complete for patient ${patient.id}.`);
        return true;
      }

      throw new Error(timeoutMessage);
    } catch (error) {
      throw new Error(`CQ discovery polling failed`);
    }
  }

  private async getPatientDiscoveryStatus(patient: Patient): Promise<boolean> {
    const updatedPatient = await getPatient({ id: patient.id, cxId: patient.cxId });

    if (!updatedPatient) {
      return false;
    }

    const cqExternalData = updatedPatient.data.externalData?.CAREQUALITY as PatientDataCarequality;

    if (!cqExternalData) {
      return false;
    }

    return cqExternalData.discoveryStatus === "completed";
  }
}
