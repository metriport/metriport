import { executeWithNetworkRetries } from "@metriport/shared";
import { Patient } from "@metriport/shared/domain/patient";
import { QuestRosterType } from "@metriport/shared/interface/external/quest/roster";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { questRosterResponseSchema } from "./api-shared";

dayjs.extend(duration);

const questRosterBaseRoute = "/internal/quest/roster";
const numberOfAttempts = 3;
const baseDelay = dayjs.duration({ milliseconds: 100 });

export async function getEnrolledPatientsForNotifications(): Promise<Patient[]> {
  const { log } = out(`Quest getEnrolledPatientsForNotifications`);
  const api = axios.create();
  const enrolledPatients: Patient[] = [];
  const questRosterRoute = `${questRosterBaseRoute}/${QuestRosterType.NOTIFICATIONS}`;
  let nextPageUrl: string | undefined = `${Config.getApiUrl()}${questRosterRoute}`;
  while (nextPageUrl) {
    const currentUrl = nextPageUrl;
    const response = await executeWithNetworkRetries(() => api.get(currentUrl), {
      maxAttempts: numberOfAttempts,
      initialDelay: baseDelay.asMilliseconds(),
      log,
    });
    const rosterPage = questRosterResponseSchema.parse(response.data);
    enrolledPatients.push(...rosterPage.patients);
    nextPageUrl = rosterPage.meta.nextPage;
  }
  return enrolledPatients;
}
