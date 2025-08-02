import { z } from "zod";
import { S3Utils } from "../aws/s3";
import { Config } from "../../util/config";
import { buildRosterFileName } from "./file/file-names";
import axios, { type AxiosResponse } from "axios";
import { Patient } from "@metriport/shared";

export interface QuestSubscriberApiResponse {
  patients: Patient[];
  meta: {
    nextPage: string | undefined;
  };
}

export const rosterSchema = z.object({
  patientIdMap: z.record(z.string(), z.string()),
  lastUpdated: z.date(),
});

export type Roster = z.infer<typeof rosterSchema>;

export async function getQuestRoster(): Promise<Roster> {
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const questBucket = Config.getQuestReplicaBucketName();
  const rosterFileName = buildRosterFileName();
  const roster = await s3Utils.downloadFile({ bucket: questBucket, key: rosterFileName });
  const rosterData = JSON.parse(roster.toString());
  return rosterSchema.parse(rosterData);
}

export async function getQuestSubscribers(): Promise<Patient[]> {
  const apiUrl = Config.getApiUrl();
  let currentUrl: string | undefined = `${apiUrl}/integration/quest/roster`;
  const allSubscribers: Patient[] = [];

  while (currentUrl) {
    const response: AxiosResponse<QuestSubscriberApiResponse> = await axios.get(currentUrl);
    allSubscribers.push(...response.data.patients);
    currentUrl = response.data.meta.nextPage;
  }

  return allSubscribers;
}
