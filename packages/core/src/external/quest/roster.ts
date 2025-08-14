import axios from "axios";
import { Config } from "../../util/config";
import { Patient } from "@metriport/shared/domain/patient";
import { questRosterResponseSchema } from "./types";
import { buildRosterFile } from "./file/file-generator";
import { out } from "../../util";

const QUEST_ROSTER_ROUTE = "/internal/quest/roster";

export async function generateQuestRoster(): Promise<Buffer> {
  const { log } = out("QuestRoster");
  let currentUrl: string | undefined = `${Config.getApiUrl()}/${QUEST_ROSTER_ROUTE}`;
  const enrolledPatients: Patient[] = [];
  do {
    const response = await axios.get(currentUrl);
    const rosterPage = questRosterResponseSchema.parse(response.data);
    enrolledPatients.push(...rosterPage.patients);
    currentUrl = rosterPage.meta.nextPage;
  } while (currentUrl);
  const rosterFile = buildRosterFile(enrolledPatients);
  log(`Generated roster file with ${enrolledPatients.length} patients`);
  return rosterFile;
}
