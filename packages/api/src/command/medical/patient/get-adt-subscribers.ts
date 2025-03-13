import { out } from "@metriport/core/util/log";
import { PatientModel } from "../../../models/medical/patient";
import { PatientSettingsModel } from "../../../models/patient-settings";

export async function getAdtSubscribers(states: string[]): Promise<PatientModel[]> {
  const { log } = out(`Get ADT Subscribers`);
  log(`States: ${states}`);

  const patientIds = await PatientSettingsModel.findAll({
    where: {
      subscribeTo: { adt: true },
    },
    attributes: ["patientId"],
  });

  const patients = await PatientModel.findAll({
    where: {
      id: patientIds.map(p => p.patientId),
    },
  });

  const patientsInSelectedStates = patients.filter(p =>
    p.data.address?.some(a => states.includes(a.state))
  );

  return patientsInSelectedStates;
}
