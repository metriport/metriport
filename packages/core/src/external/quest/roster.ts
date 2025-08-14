import axios from "axios";
import dayjs from "dayjs";
import { executeWithNetworkRetries } from "@metriport/shared";
import { Config } from "../../util/config";
import { Patient } from "@metriport/shared/domain/patient";
import { questRosterResponseSchema } from "./types";
import { buildRosterFile } from "./file/file-generator";
import { out, LogFunction } from "../../util";

const QUEST_ROSTER_ROUTE = "/internal/quest/roster";
const NUMBER_OF_ATTEMPTS = 3;
const BASE_DELAY = dayjs.duration({ milliseconds: 100 });

export async function generateQuestRoster(): Promise<Buffer> {
  const { log } = out("QuestRoster");
  let currentUrl: string | undefined = `${Config.getApiUrl()}/${QUEST_ROSTER_ROUTE}`;

  const enrolledPatients: Patient[] = [];
  while (currentUrl) {
    const response = await getWithRetries(currentUrl, log);
    const rosterPage = questRosterResponseSchema.parse(response.data);
    enrolledPatients.push(...rosterPage.patients);
    currentUrl = rosterPage.meta.nextPage;
  }
  const rosterFile = buildRosterFile(enrolledPatients);
  log(`Generated roster file with ${enrolledPatients.length} patients`);
  return rosterFile;
}

async function getWithRetries(url: string, log: LogFunction) {
  return await executeWithNetworkRetries(() => axios.get(url), {
    maxAttempts: NUMBER_OF_ATTEMPTS,
    initialDelay: BASE_DELAY.asMilliseconds(),
    log,
  });
}
