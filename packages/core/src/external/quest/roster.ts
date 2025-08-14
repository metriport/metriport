import { Config } from "../../util/config";
import axios from "axios";
import { questRosterResponseSchema } from "./types";

export async function generateQuestRoster() {
  const internalApi = axios.create({
    baseURL: Config.getApiUrl(),
  });
  const internalRoute = "/internal/quest/roster";

  const response = await internalApi.get(internalRoute);
  try {
    const rosterPage = questRosterResponseSchema.parse(response.data);
    console.log(rosterPage);
  } catch (error) {
    console.error(JSON.stringify(error, null, 2));
  }
}
