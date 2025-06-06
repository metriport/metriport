import { dataPipelineEvents } from "@metriport/core/command/data-pipeline/event";
import { DocumentQueryStatus, Progress, ProgressType } from "@metriport/core/domain/document-query";
import { Patient, PatientCreate, PatientData } from "@metriport/core/domain/patient";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import stringify from "json-stringify-safe";
import { QueryTypes } from "sequelize";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { recreateConsolidated } from "../patient/consolidated-recreate";
import { getPatientOrFail } from "../patient/get-patient";
import { sendWHNotifications } from "./check-doc-queries-notification";
import {
  GroupedValidationResult,
  PatientsWithValidationResult,
  SingleValidationResult,
} from "./check-doc-queries-shared";

dayjs.extend(duration);

const MAX_TIME_TO_PROCESS = dayjs.duration({ minutes: 30 });
const BUFFER_TIME = dayjs.duration({ minutes: 16 });
const MAX_CONCURRENT_UDPATES = 10;

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
  const { log } = out(`checkDocumentQueries - patientIds ${patientIds.join(", ")}`);
  try {
    const patientsToUpdate: PatientsWithValidationResult = {};

    const patientsWithInvalidStatusOrCount = await getPatientsToUpdate(patientIds);
    for (const patient of patientsWithInvalidStatusOrCount) {
      const docQueryProgress = patient.data.documentQueryProgress;
      if (!docQueryProgress) {
        log(`Patient without doc query progress @ query, skipping it: ${patient.id} `);
        continue;
      }

      const checkInvalid = (prop: Progress): SingleValidationResult => {
        const { status, total = 0 } = prop;
        const isTotalValid = total === calculateTotal(prop);
        const isStatusValid = isValidStatus(status);
        if (status === "failed") return undefined;
        if (!isTotalValid && !isStatusValid) return "both";
        if (!isTotalValid) return "total";
        if (!isStatusValid) return "status";
        return undefined;
      };

      if (docQueryProgress.convert) {
        const whatsInvalid = checkInvalid(docQueryProgress.convert);
        if (whatsInvalid !== undefined) {
          patientsToUpdate[patient.id] = { convert: whatsInvalid, cxId: patient.cxId };
        }
      }
      if (docQueryProgress.download) {
        const whatsInvalid = checkInvalid(docQueryProgress.download);
        if (whatsInvalid !== undefined) {
          patientsToUpdate[patient.id] = {
            ...patientsToUpdate[patient.id],
            download: whatsInvalid,
            cxId: patient.cxId,
          };
        }
      }
    }

    await updateDocQueryStatus(patientsToUpdate);

    const updatedPatientIds = Object.keys(patientsToUpdate);
    const amount = updatedPatientIds.length;
    if (amount > 0) {
      const msg = "Fixed patients with unexpected doc query status";
      const extra = { amount, patientsToUpdate: updatedPatientIds.join(", ") };
      capture.message(msg, { extra, level: "warning" });
      log(msg, stringify(extra));
    } else {
      if (patientsWithInvalidStatusOrCount.length > 0) {
        log("Got patients with invalid status from the DB, but no patients to update");
      }
    }

    sendWHNotifications(patientsToUpdate);

    log(`Done, ${amount} patients found and updated`);
  } catch (error) {
    const msg = "Error checking document queries";
    log(msg, String(error));
    capture.message(msg, { extra: { patientIds, error }, level: "error" });
  }
}

function isValidStatus(status: DocumentQueryStatus): boolean {
  return status !== "processing";
}
function getStatus(prop: Progress) {
  return isValidStatus(prop.status) ? prop.status : "completed";
}
function calculateTotal(prop: Progress) {
  return (prop.errors ?? 0) + (prop.successful ?? 0);
}

async function updateDocQueryStatus(patients: PatientsWithValidationResult): Promise<void> {
  const uniquePatients = Object.entries(patients);
  await executeAsynchronously(
    uniquePatients,
    async patients => updatePatientsInSequence(patients),
    { numberOfParallelExecutions: MAX_CONCURRENT_UDPATES }
  );
}

async function updatePatientsInSequence([patientId, { cxId, ...whatToUpdate }]: [
  string,
  GroupedValidationResult
]): Promise<void> {
  const { log } = out(`updatePatientsInSequence cx ${cxId} patient ${patientId}`);
  let requestId: string | undefined = undefined;
  async function updatePatient(): Promise<Patient | undefined> {
    const patientFilter = { id: patientId, cxId };
    return executeOnDBTx(PatientModel.prototype, async transaction => {
      const patient = await getPatientOrFail({
        ...patientFilter,
        lock: true,
        transaction,
      });

      const docProgress = patient.data.documentQueryProgress;
      if (!docProgress) {
        log(`Patient without doc query progress @ update, skipping it`);
        return undefined;
      }
      requestId = docProgress.requestId;
      if (whatToUpdate.convert) {
        const convert = docProgress.convert;
        docProgress.convert = convert
          ? {
              ...convert,
              status: getStatus(convert),
              total: calculateTotal(convert),
            }
          : undefined;
      }
      if (whatToUpdate.download) {
        const download = docProgress.download;
        docProgress.download = download
          ? {
              ...download,
              status: getStatus(download),
              total: calculateTotal(download),
            }
          : undefined;
      }

      const updatedPatient = {
        ...patient,
        data: {
          ...patient.data,
          documentQueryProgress: docProgress,
        },
      };

      await PatientModel.update(updatedPatient, { where: patientFilter, transaction });

      return updatedPatient;
    });
  }
  const patient = await updatePatient();
  if (!patient) return;
  // we want to await here to ensure the consolidated bundle is created before we send the webhook
  await recreateConsolidated({ patient, context: "check-queries" });

  requestId &&
    dataPipelineEvents().succeeded({
      cxId: patient.cxId,
      patientId: patient.id,
      requestId,
    });
}

export async function getPatientsToUpdate(patientIds?: string[]): Promise<Patient[]> {
  const query = getQuery(patientIds);

  const patientsWithInvalidDocQueries = (await PatientModel.sequelize?.query(query, {
    type: QueryTypes.SELECT,
    mapToModel: true,
    instance: new PatientModel(),
  })) as Patient[];

  if (!patientsWithInvalidDocQueries) {
    capture.message("patientsWithInvalidDocQueries is undefined/null", {
      extra: { patientsWithInvalidDocQueries, query },
      level: "warning",
    });
    return [];
  }
  if (!Array.isArray(patientsWithInvalidDocQueries)) {
    capture.message("patientsWithInvalidDocQueries is not an array", {
      extra: { patientsWithInvalidDocQueries, query },
      level: "warning",
    });
    return [];
  }

  // 'updatedAt' is not being set by sequelize, so we need to set it manually
  patientsWithInvalidDocQueries.forEach(patient => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!patient.updatedAt) patient.updatedAt = (patient as any)["updated_at"];
  });

  return patientsWithInvalidDocQueries;
}

function getQuery(patientIds: string[] = []): string {
  // START - Workaround to force a compilation error if we change something on the model, since we're
  // using raw SQL here.
  const data: keyof Pick<PatientCreate, "data"> = "data";
  const documentQueryProgress: keyof Pick<PatientData, "documentQueryProgress"> =
    "documentQueryProgress";
  const status: keyof Pick<Progress, "status"> = "status";
  const total: keyof Pick<Progress, "total"> = "total";
  const successful: keyof Pick<Progress, "successful"> = "successful";
  const errors: keyof Pick<Progress, "errors"> = "errors";
  const processing: DocumentQueryStatus = "processing";
  // END

  const property = (propertyName: ProgressType) =>
    `${data}->'${documentQueryProgress}'->'${propertyName}'`;
  const convert = property("convert");
  const download = property("download");

  const from = MAX_TIME_TO_PROCESS.add(BUFFER_TIME).asMinutes();
  const to = MAX_TIME_TO_PROCESS.asMinutes();

  const baseQuery =
    `select * from patient ` +
    `where updated_at > now() - interval '${from}' minute ` +
    `  and updated_at < now() - interval '${to}' minute ` +
    `  and ((${convert}->'${total}')::int <> (${convert}->'${successful}')::int + (${convert}->'${errors}')::int ` +
    `        or ` +
    `        ${convert}->>'${status}' = '${processing}' ` +
    `        or ` +
    `        (${download}->'${total}')::int <> (${download}->'${successful}')::int + (${download}->'${errors}')::int ` +
    `        or ` +
    `        ${download}->>'${status}' = '${processing}') `;

  const patientFilter = patientIds.length > 0 ? ` and id in ('${patientIds.join("','")}')` : "";
  return baseQuery + patientFilter;
}
