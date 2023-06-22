import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import stringify from "json-stringify-safe";
import { QueryTypes } from "sequelize";
import { Progress } from "../../../domain/medical/document-reference";
import { Patient, PatientModel } from "../../../models/medical/patient";
import { capture } from "../../../shared/notifications";
import { Util } from "../../../shared/util";

dayjs.extend(duration);

const MAX_CONVERSION_TIME = dayjs.duration({ minutes: 30 });
const MAX_DOWNLOAD_TIME = dayjs.duration({ minutes: 30 });

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
    const patientsToUpdate: Record<string, { convert?: Progress; download?: Progress }> = {};

    const patientsWithDownloadsProcessing = await getDownloadsToUpdate(patientIds);
    for (const patient of patientsWithDownloadsProcessing) {
      patientsToUpdate[patient.id] = {
        download: patient.data.documentQueryProgress?.download ?? ({} as Progress),
      };
      // not updating the DB nor triggering webhook at this time
    }

    const patientsWithConversionsInProgress = await getConversionsToUpdate(patientIds);
    for (const patient of patientsWithConversionsInProgress) {
      patientsToUpdate[patient.id] = {
        ...patientsToUpdate[patient.id],
        convert: patient.data.documentQueryProgress?.convert ?? ({} as Progress),
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
    log(msg, error);
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

  return patientsWithDocQueriesInProgress;
}

function getQuery(
  propertyName: "convert" | "download",
  maxTime: duration.Duration,
  patientIds: string[] = []
): string {
  // START - Literally just making sure we bring our attention to this query if we change something with the patient model
  // so we update the query as well
  const voidPatient = { data: {} } as PatientModel;
  const c: Progress = voidPatient.data.documentQueryProgress?.convert ?? ({} as Progress);
  [c?.status, c?.total, c?.successful, c?.errors];
  const d: Progress = voidPatient.data.documentQueryProgress?.download ?? ({} as Progress);
  [d?.status, d?.total, d?.successful, d?.errors];
  // END

  const property = `data->'documentQueryProgress'->'${propertyName}'`;
  const baseQuery =
    `select * from patient ` +
    `where ${property}->>'status' = 'processing' ` +
    `and ( ` +
    `  (${property}->'total')::int <= ( ` +
    `    (${property}->'successful')::int + ` +
    `    (${property}->'errors')::int ` +
    `  ) ` +
    `  or ` +
    `  updated_at < '${dayjs().subtract(maxTime.asSeconds(), "second").toISOString()}' ` +
    `)`;
  const patientFilter = patientIds.length > 0 ? ` and id in ('${patientIds.join("','")}')` : "";
  return baseQuery + patientFilter;
}
