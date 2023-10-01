import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import stringify from "json-stringify-safe";
import { QueryTypes } from "sequelize";
import { DocumentQueryProgress, Progress } from "../../../domain/medical/document-query";
import { Patient, PatientCreate, PatientData, PatientModel } from "../../../models/medical/patient";
import { capture } from "../../../shared/notifications";
import { Util } from "../../../shared/util";

dayjs.extend(duration);

const MAX_CONVERSION_TIME = dayjs.duration({ minutes: 30 });
const MAX_DOWNLOAD_TIME = dayjs.duration({ minutes: 30 });

type PatientInfoFromCheck = { convert?: Progress; download?: Progress; lastUpdatedAt: Date };

/**
 * Ops-driven function to check the status of all document queries in progress.
 * NOT TO BE USED BY CUSTOMERS DIRECTLY.
 *
 * For each patient with a document query in progress that match the criteria,
 * it will update the status to `completed` and trigger the webhook.
 *
 * @param patientIds - Optional list of patient IDs to check. If not provided, all patients will be checked.
 */
export async function checkDocumentQueries(patientIds: string[]): Promise<void> {
  const { log } = Util.out(`checkDocumentQueries - patientIds ${patientIds.join(", ")}`);
  try {
    const patientsToUpdate: Record<string, PatientInfoFromCheck> = {};

    const patientsWithDownloadsProcessing = await getDownloadsToUpdate(patientIds);
    for (const patient of patientsWithDownloadsProcessing) {
      patientsToUpdate[patient.id] = {
        download: patient.data.documentQueryProgress?.download ?? ({} as Progress),
        lastUpdatedAt: patient.updatedAt,
      };
      // not updating the DB nor triggering webhook at this time
    }

    const patientsWithConversionsInProgress = await getConversionsToUpdate(patientIds);
    for (const patient of patientsWithConversionsInProgress) {
      patientsToUpdate[patient.id] = {
        ...patientsToUpdate[patient.id],
        convert: patient.data.documentQueryProgress?.convert ?? ({} as Progress),
        lastUpdatedAt: patient.updatedAt,
      };
    }

    const amount = Object.keys(patientsToUpdate).length;
    if (amount > 0) {
      const msg = "Patients with unexpected doc query status";
      const extra = { amount, patientsToUpdate };
      capture.message(msg, { extra, level: "warning" });
      log(msg, stringify(extra));
    }

    log(`Done (${amount} patients found)`);
  } catch (error) {
    const msg = "Error checking document queries";
    log(msg, String(error));
    capture.message(msg, { extra: { patientIds, error }, level: "error" });
  }
}

export async function getDownloadsToUpdate(patientIds?: string[]): Promise<Patient[]> {
  return getPatientsToUpdate("download", MAX_DOWNLOAD_TIME, patientIds);
}
export async function getConversionsToUpdate(patientIds?: string[]): Promise<Patient[]> {
  return getPatientsToUpdate("convert", MAX_CONVERSION_TIME, patientIds);
}
export async function getPatientsToUpdate(
  propertyName: "convert" | "download",
  maxTime: duration.Duration,
  patientIds?: string[]
): Promise<Patient[]> {
  const query = getQuery(propertyName, maxTime, patientIds);

  const patientsWithDocQueriesInProgress = (await PatientModel.sequelize?.query(query, {
    type: QueryTypes.SELECT,
    mapToModel: true,
    instance: new PatientModel(),
  })) as Patient[];

  if (!patientsWithDocQueriesInProgress) {
    capture.message("patientsWithDocQueriesInProgress is undefined/null", {
      extra: { patientsWithDocQueriesInProgress, propertyName, query },
      level: "warning",
    });
    return [];
  }
  if (!Array.isArray(patientsWithDocQueriesInProgress)) {
    capture.message("patientsWithDocQueriesInProgress is not an array", {
      extra: { patientsWithDocQueriesInProgress, propertyName, query },
      level: "warning",
    });
    return [];
  }

  // 'updatedAt' is not being set by sequelize, so we need to set it manually
  patientsWithDocQueriesInProgress.forEach(patient => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!patient.updatedAt) patient.updatedAt = (patient as any)["updated_at"];
  });

  return patientsWithDocQueriesInProgress;
}

function getQuery(
  propertyName: keyof Pick<DocumentQueryProgress, "convert" | "download">,
  maxTime: duration.Duration,
  patientIds: string[] = []
): string {
  // START - Workaround to force a compilation error if we change something on the model, since we're
  // using raw SQL here.
  const data: keyof Pick<PatientCreate, "data"> = "data";
  const documentQueryProgress: keyof Pick<PatientData, "documentQueryProgress"> =
    "documentQueryProgress";
  const status: keyof Pick<Progress, "status"> = "status";
  const total: keyof Pick<Progress, "total"> = "total";
  const successful: keyof Pick<Progress, "successful"> = "successful";
  const errors: keyof Pick<Progress, "errors"> = "errors";
  // END

  const property = `${data}->'${documentQueryProgress}'->'${propertyName}'`;
  const baseQuery =
    `select * from patient ` +
    `where ${property}->>'${status}' = 'processing' ` +
    `and ( ` +
    `  (${property}->'${total}')::int <= ( ` +
    `    (${property}->'${successful}')::int + ` +
    `    (${property}->'${errors}')::int ` +
    `  ) ` +
    `  or ` +
    `  updated_at < '${dayjs().subtract(maxTime.asSeconds(), "second").toISOString()}' ` +
    `)`;
  const patientFilter = patientIds.length > 0 ? ` and id in ('${patientIds.join("','")}')` : "";
  return baseQuery + patientFilter;
}
