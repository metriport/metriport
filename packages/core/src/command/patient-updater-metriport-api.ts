import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { PatientUpdater } from "../domain/patient-updater";

dayjs.extend(duration);

const UPDATE_TIMEOUT = dayjs.duration({ minutes: 2 });

/**
 * Implementation of the PatientUpdater that calls the Metriport API
 * to execute each its functions.
 */
export class PatientUpdaterMetriportAPI extends PatientUpdater {
  constructor(private readonly apiUrl: string) {
    super();
  }

  public async updateAll(
    cxId: string,
    patientIds: string[]
  ): Promise<{ failedUpdateCount: number }> {
    console.log(`Calling API /update-all...`);

    const resp = await axios.post(
      `${this.apiUrl}/internal/patient/update-all?cxId=${cxId}`,
      {
        patientIds,
      },
      { timeout: UPDATE_TIMEOUT.asMilliseconds() }
    );
    return resp.data;
  }
}
