import { QuestRosterType } from "@metriport/shared/interface/external/quest/roster";
import { Config } from "../../util/config";
import { S3Replica } from "../sftp/replica/s3";
import { QuestSftpConfig } from "./client";
import { buildQuestPatientResponseFileName } from "./file/file-names";

export const QUEST_PATIENT_RESPONSE_DIRECTORY = "quest_patient_response_files";

export class QuestReplica extends S3Replica {
  constructor(config: Pick<QuestSftpConfig, "replicaBucket" | "replicaBucketRegion"> = {}) {
    super({
      bucketName: config.replicaBucket ?? Config.getQuestReplicaBucketName() ?? "",
      region: config.replicaBucketRegion ?? Config.getAWSRegion(),
    });
  }

  async uploadQuestPatientResponseFile({
    externalId,
    dateId,
    rosterType,
    fileContent,
  }: {
    externalId: string;
    dateId: string;
    rosterType: QuestRosterType;
    fileContent: Buffer;
  }): Promise<void> {
    const fileName = buildQuestPatientResponseFileName({ externalId, dateId, rosterType });
    await this.writeFile(`${QUEST_PATIENT_RESPONSE_DIRECTORY}/${fileName}`, fileContent);
  }

  async getQuestPatientResponseFile({
    externalId,
    dateId,
    rosterType,
  }: {
    externalId: string;
    dateId: string;
    rosterType: QuestRosterType;
  }): Promise<Buffer> {
    const fileName = buildQuestPatientResponseFileName({ externalId, dateId, rosterType });
    return await this.readFile(`${QUEST_PATIENT_RESPONSE_DIRECTORY}/${fileName}`);
  }
}
