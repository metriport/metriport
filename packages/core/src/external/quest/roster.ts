import { Config } from "../../util/config";
import axios from "axios";
import { questRosterResponseSchema } from "./types";
import { generateRosterFile } from "./file/file-generator";
import { out } from "../../util";

export async function generateQuestRoster() {
  const { log } = out("QuestRoster");
  const internalApi = axios.create({
    baseURL: Config.getApiUrl(),
  });
  const internalRosterRoute = "/internal/quest/roster";

  const response = await internalApi.get(internalRosterRoute);
  try {
    const rosterPage = questRosterResponseSchema.parse(response.data);
    const rosterFile = generateRosterFile(rosterPage.patients);
    log("Generated roster file");
    console.log(rosterFile.content.toString("utf-8"));
  } catch (error) {
    console.error(JSON.stringify(error, null, 2));
  }
}
