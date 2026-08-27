import { BadRequestError, errorToString } from "@metriport/shared";
import { Patient } from "@metriport/shared/domain/patient";
import {
  isBackfillRosterType,
  isNotificationRosterType,
  QuestRosterType,
} from "@metriport/shared/interface/external/quest/roster";
import { questSource } from "@metriport/shared/interface/external/quest/source";
import {
  getCxsWithQuestFeatureFlag,
  isQuestFeatureFlagEnabledForCx,
} from "../../../../command/feature-flags/domain-ffs";
import { getLatestRoster } from "../../../../command/roster/api/get-latest-roster";
import { getRoster } from "../../../../command/roster/api/get-roster";
import { updateRoster } from "../../../../command/roster/api/update-roster";
import { LogFunction, out } from "../../../../util";
import { Config } from "../../../../util/config";
import { S3Utils, storeInS3WithRetries } from "../../../aws/s3";
import { getEnrolledPatientsForNotifications } from "../../../quest/api/get-enrolled-patient-for-notifications";
import { buildRosterFile } from "../../../quest/file/file-generator";
import { buildRosterFileName, buildRosterFileNameForRoster } from "../../../quest/file/file-names";
import { getEnrolledPatientsForBackfill } from "../../api/get-enrolled-patient-for-backfill";
import { QuestRosterPatient, QuestRosterResult } from "../../types";
import { QuestRosterRequest } from "./upload-roster";

/**
 * Closes a Quest roster and returns the roster result.
 *
 * @param rosterType - The type of roster to generate.
 * @param cxId - The CX ID of the customer. Must be provided with rosterId for single-customer rosters.
 * @param rosterId - The ID of the roster. Must be provided without cxId for single-customer rosters.
 * @returns The roster result.
 * @throws BadRequestError if the roster type is invalid.
 */
export async function closeRoster({
  rosterType,
  cxId,
  rosterId,
}: QuestRosterRequest): Promise<QuestRosterResult | undefined> {
  const { log } = out(`quest.closeRoster - rosterType ${rosterType}`);

  if (cxId && rosterId) {
    if (!isBackfillRosterType(rosterType)) {
      throw new BadRequestError("Roster type must be backfill for single customer rosters");
    }
    await validateRequester(cxId);
    const roster = await getRoster({ cxId, rosterId });
    if (roster.source !== questSource || roster.type !== rosterType) {
      throw new BadRequestError(
        "Roster type does not match the requested source and type",
        undefined,
        {
          cxId,
          rosterId,
          rosterType,
          source: roster.source,
          type: roster.type,
        }
      );
    }
    await updateRoster({ cxId, rosterId, status: "closed" });
    const enrolledPatients = await getEnrolledPatientsForBackfill({ cxId, rosterId });
    const rosterContent = buildRosterFile(enrolledPatients, rosterType);
    const rosterFileName = buildRosterFileNameForRoster({ rosterId, rosterType });
    await storeRosterInS3(rosterFileName, rosterContent, log);
    const patients = enrolledPatients.map(p => ({ cxId, patientId: p.id }));
    log(`Generated single customer roster file with ${enrolledPatients.length} patients`);
    return { rosterFileName, rosterContent, patients };
  } else if (cxId || rosterId) {
    throw new BadRequestError("CX ID or roster ID provided without the other");
  }

  let enrolledPatients: Patient[] = [];
  const rosterPatients: QuestRosterPatient[] = [];
  if (isNotificationRosterType(rosterType)) {
    enrolledPatients = await getEnrolledPatientsForNotifications();
    // Notification rosters don't have cxId context, so we don't track patients for status updates
  } else if (isBackfillRosterType(rosterType)) {
    const cxIds = await getCxsWithQuestFeatureFlag();
    for (const cxId of cxIds) {
      try {
        const rosterId = await getLatestRoster({
          cxId,
          source: questSource,
          type: QuestRosterType.BACKFILL,
        });
        if (!rosterId) {
          log(`No roster found for cxId ${cxId} and type ${rosterType}`);
          continue;
        }
        await updateRoster({ cxId, rosterId, status: "closed" });
        const cxEnrolledPatients = await getEnrolledPatientsForBackfill({
          cxId,
          rosterId,
        });
        enrolledPatients.push(...cxEnrolledPatients);
        rosterPatients.push(...cxEnrolledPatients.map(p => ({ cxId, patientId: p.id })));
        log(`Added roster for cxId ${cxId} with ${cxEnrolledPatients.length} patients`);
      } catch (error) {
        log(`Error adding roster for cx ${cxId}: ${errorToString(error)}`);
        continue;
      }
    }
  }
  if (enrolledPatients.length < 1) {
    log(`No enrolled patients found for roster type ${rosterType}`);
    return undefined;
  }
  const rosterContent = buildRosterFile(enrolledPatients, rosterType);
  const rosterFileName = buildRosterFileName({ rosterType });
  await storeRosterInS3(rosterFileName, rosterContent, log);
  log(`Generated ${rosterType} roster file with ${enrolledPatients.length} patients`);
  return { rosterFileName, rosterContent, patients: rosterPatients };
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
    s3Utils,
    payload: rosterContent.toString(),
    bucketName: replicaBucketName,
    fileName: `roster/${rosterFileName}`,
    contentType: "text/plain",
    log,
  });
}

async function validateRequester(cxId: string): Promise<void> {
  const isQuestEnabled = await isQuestFeatureFlagEnabledForCx(cxId);
  if (!isQuestEnabled) {
    throw new BadRequestError("Quest is not enabled for cx", undefined, {
      cxId,
    });
  }
}
