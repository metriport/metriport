import axios from "axios";
import dayjs from "dayjs";
import { executeWithNetworkRetries } from "@metriport/shared";
import { Config } from "../../util/config";
import { Patient } from "@metriport/shared/domain/patient";
import { questRosterResponseSchema } from "./types";
import { buildRosterFileName } from "./file/file-names";
import { buildRosterFile } from "./file/file-generator";
import { out, LogFunction } from "../../util";
import { S3Utils, storeInS3WithRetries } from "../aws/s3";

const QUEST_ROSTER_ROUTE = "/internal/quest/roster";
const NUMBER_OF_ATTEMPTS = 3;
const BASE_DELAY = dayjs.duration({ milliseconds: 100 });

function getQuestRosterRoute(notifications?: boolean | undefined) {
  return QUEST_ROSTER_ROUTE + (notifications ? "/notifications" : "/backfill");
}

export async function generateQuestRoster({
  notifications,
}: {
  notifications?: boolean | undefined;
}): Promise<{
  rosterFileName: string;
  rosterContent: Buffer;
}> {
  const { log } = out("QuestRoster");
  const enrolledPatients = await getAllEnrolledPatients({ notifications, log });
  const rosterContent = buildRosterFile(enrolledPatients);
  log(`Generated roster file with ${enrolledPatients.length} patients`);

  const rosterFileName = buildRosterFileName({ notifications });
  await storeRosterInS3(rosterFileName, rosterContent, log);
  return { rosterFileName, rosterContent };
}

async function getAllEnrolledPatients({
  notifications,
  log,
}: {
  notifications?: boolean | undefined;
  log: LogFunction;
}): Promise<Patient[]> {
  const enrolledPatients: Patient[] = [];
  const questRosterRoute = getQuestRosterRoute(notifications);
  let currentUrl: string | undefined = Config.getApiUrl() + questRosterRoute;
  while (currentUrl) {
    const response = await getWithNetworkRetries(currentUrl, log);
    const rosterPage = questRosterResponseSchema.parse(response.data);
    enrolledPatients.push(...rosterPage.patients);
    currentUrl = rosterPage.meta.nextPage;
  }
  return enrolledPatients;
}

async function getWithNetworkRetries(url: string, log: LogFunction) {
  return await executeWithNetworkRetries(() => axios.get(url), {
    maxAttempts: NUMBER_OF_ATTEMPTS,
    initialDelay: BASE_DELAY.asMilliseconds(),
    log,
  });
}

async function storeRosterInS3(
  rosterFileName: string,
  rosterContent: Buffer,
  log: LogFunction
): Promise<void> {
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const replicaBucketName = Config.getQuestReplicaBucketName();
  if (!replicaBucketName) {
    log("Quest replica bucket name is not set");
    return;
  }

  await storeInS3WithRetries({
    s3Utils: s3Utils,
    payload: rosterContent.toString(),
    bucketName: replicaBucketName,
    fileName: `roster/${rosterFileName}`,
    contentType: "text/plain",
    log,
  });
}
