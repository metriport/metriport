import { capture } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { errorToString } from "@metriport/shared";
import { PatientModel } from "../../../models/medical/patient";
import { PatientSettingsModel } from "../../../models/patient-settings";

export async function getAdtSubscribers(states: string[]): Promise<PatientModel[]> {
  const { log } = out(`Get ADT Subscribers`);
  log(`States: ${states}`);
  try {
    const patients = await PatientModel.findAll({
      include: [
        {
          model: PatientSettingsModel,
          as: "settings",
          where: {
            subscriptions: { adt: true },
          },
          attributes: ["patient_id"],
        },
      ],
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
