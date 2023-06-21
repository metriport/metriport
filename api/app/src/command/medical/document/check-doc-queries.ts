import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { QueryTypes } from "sequelize";
import { Progress } from "../../../domain/medical/document-reference";
import { Patient, PatientModel } from "../../../models/medical/patient";
import { capture } from "../../../shared/notifications";
import { Util } from "../../../shared/util";
import {
  MAPIWebhookStatus,
  MAPIWebhookType,
  processPatientDocumentRequest,
} from "../../webhook/medical";
import { appendDocQueryProgress } from "../patient/append-doc-query-progress";

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
    const patientsWithDownloadsProcessing = await getDownloadsToUpdate(patientIds);
    log(
      `Got ${
        patientsWithDownloadsProcessing.length
      } patients with downloads 'processing' to be moved to 'completed': ${patientsWithDownloadsProcessing.join(
        ", "
      )}`
    );
    for (const patient of patientsWithDownloadsProcessing) {
      await appendDocQueryProgress({
        patient,
        downloadProgress: {
          status: "completed",
        },
      });
      processPatientDocumentRequest(
        patient.cxId,
        patient.id,
        MAPIWebhookType.documentDownload,
        MAPIWebhookStatus.completed
        // Can we send these without the list of documents?
        // Concerned with either:
        // - doing one patient at a time and taking so long that rolls over the next execution; OR
        // - doing all patients at once and hammering the FHIR server
        // toDTO(docsNewLocation)
      );
    }

    const patientsWithConversionsInProgress = await getConversionsToUpdate(patientIds);
    log(
      `Got ${
        patientsWithConversionsInProgress.length
      } patients with conversions 'processing' to be moved to 'completed': ${patientsWithConversionsInProgress.join(
        ", "
      )}`
    );
    for (const patient of patientsWithConversionsInProgress) {
      await appendDocQueryProgress({
        patient,
        convertProgress: {
          status: "completed",
        },
      });
      processPatientDocumentRequest(
        patient.cxId,
        patient.id,
        MAPIWebhookType.documentConversion,
        MAPIWebhookStatus.completed
      );
    }

    log(`Done`);
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
    // nest: true,
    mapToModel: true,
    instance: new PatientModel(),
  })) as Patient[];

  // const patientsWithDocQueriesInProgress = await PatientModel.findAll({
  //   where: {
  //     [Op.and]: [
  //       Sequelize.json("data->'documentQueryProgress'->'convert'->>'status'", "processing"),
  //       {
  //         [Op.or]: [
  //           // ### 1st attempt
  //           // Sequelize.json(
  //           //   "data->'documentQueryProgress'->'convert'->'total')::int <= ((data->'documentQueryProgress'->'convert'->'successful')::int + (data->'documentQueryProgress'->'convert'->'errors')::int)"
  //           // ),
  //           //
  //           // ### 2nd attempt
  //             quelize.json("data->'documentQueryProgress'->'convert'->'total')::int"): {
  //             [Op.lte]: "Sequelize.json("
  //           },
  //           Sequelize.where(
  //             // Sequelize.col(
  //             Sequelize.json("data->'documentQueryProgress'->'convert'->'total')::int"),
  //             // ),
  //             {
  //               [Op.lte]: Sequelize.json(
  //                 "data->'documentQueryProgress'->'convert'->'total')::int <= ((data->'documentQueryProgress'->'convert'->'successful')::int + (data->'documentQueryProgress'->'convert'->'errors')::int)"
  //               ),
  //             }
  //           ),
  //           //
  //           {
  //             updatedAt: { [Op.lt]: dayjs().subtract(30, "minutes").toISOString() },
  //           },
  //         ],
  //       },
  //     ],
  //   },
  // });
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
