import { capture } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { errorToString } from "@metriport/shared";
import { PatientModel } from "../../../models/medical/patient";
import { PatientSettingsModel } from "../../../models/patient-settings";

export async function getAdtSubscribers(states: string[]): Promise<PatientModel[]> {
  const { log } = out(`Get ADT Subscribers`);
  log(`States: ${states}`);
  try {
    // TODO: See if we can do a JOIN operation on the DB
    const patientIds = await PatientSettingsModel.findAll({
      where: {
        subscribeTo: { adt: true },
      },
      attributes: ["patientId"],
    });

    if (patientIds.length === 0) return [];

    const patients = await PatientModel.findAll({
      where: {
        id: patientIds.map(p => p.patientId),
      },
    });

    const patientsInSelectedStates = patients.filter(p =>
      p.data.address?.some(a => states.includes(a.state))
    );

    return patientsInSelectedStates;
  } catch (error) {
    const msg = `Failed to get ADT subscribers`;
    log(`${msg} - err: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        error,
        states,
      },
    });
    throw new Error(msg, { cause: error });
  }
}
