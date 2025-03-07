import { SQSClient } from "@metriport/core/external/aws/sqs";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { Config } from "@metriport/core/util/config";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { MetriportError, errorToString } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { uniqBy } from "lodash";
import { getCxMappingsBySource } from "../../../../command/mapping/cx";
import {
  Appointment,
  EhrSources,
  delayBetweenPracticeBatches,
  getLookBackTimeRange,
  parallelPatients,
  parallelPractices,
} from "../../shared";
import { createAthenaClient } from "../shared";
import { SyncAthenaPatientIntoMetriportParams } from "./sync-patient";

dayjs.extend(duration);

const catupUpLookBack = dayjs.duration(12, "hours");

type GetAppointmentsParams = {
  cxId: string;
  practiceId: string;
  departmentIds?: string[];
  fromDate?: Date;
  toDate?: Date;
};

export async function processPatientsFromAppointmentsSub({ catchUp }: { catchUp: boolean }) {
  const { log } = out(`AthenaHealth processPatientsFromAppointmentsSub - catchUp: ${catchUp}`);

  const { startRange, endRange } = catchUp
    ? getLookBackTimeRange({ lookBack: catupUpLookBack })
    : {
        startRange: undefined,
        endRange: undefined,
      };
  if (startRange || endRange) {
    log(`Getting appointments from ${startRange} to ${endRange}`);
  } else {
    log(`Getting appointments with no range`);
  }

  const cxMappings = await getCxMappingsBySource({ source: EhrSources.athena });

  const allAppointments: Appointment[] = [];
  const getAppointmentsErrors: { error: unknown; cxId: string; practiceId: string }[] = [];
  const getAppointmentsArgs: GetAppointmentsParams[] = cxMappings.map(mapping => {
    const cxId = mapping.cxId;
    const practiceId = mapping.externalId;
    const departmentIds = mapping.secondaryMappings?.departmentIds;
    if (departmentIds && !Array.isArray(departmentIds)) {
      const msg = "CxMapping departmentIds is malformed @ AthenaHealth";
      log(
        `${msg}. cxId ${cxId} practiceId ${practiceId} departmentIds ${JSON.stringify(
          departmentIds
        )}`
      );
      throw new MetriportError(msg, undefined, {
        cxId,
        practiceId,
      });
    }
    return {
      cxId,
      practiceId,
      departmentIds,
      fromDate: startRange,
      toDate: endRange,
    };
  });

  await executeAsynchronously(
    getAppointmentsArgs,
    async (params: GetAppointmentsParams) => {
      const { appointments, error } = await getAppointments(params);
      if (appointments) allAppointments.push(...appointments);
      if (error) getAppointmentsErrors.push({ error, ...params });
    },
    {
      numberOfParallelExecutions: parallelPractices,
      delay: delayBetweenPracticeBatches.asMilliseconds(),
    }
  );

  if (getAppointmentsErrors.length > 0) {
    const msg = "Failed to get some appointments from subscription @ AthenaHealth";
    capture.message(msg, {
      extra: {
        getAppointmentsArgsCount: getAppointmentsArgs.length,
        errorCount: getAppointmentsErrors.length,
        errors: getAppointmentsErrors,
        context: "athenahealth.process-patients-from-appointments-sub",
      },
      level: "warning",
    });
  }

  const uniqueAppointments: Appointment[] = uniqBy(allAppointments, "patientId");

  const syncPatientsErrors: {
    error: unknown;
    cxId: string;
    athenaPracticeId: string;
    athenaPatientId: string;
  }[] = [];
  const syncPatientsArgs: SyncAthenaPatientIntoMetriportParams[] = uniqueAppointments.map(
    appointment => {
      return {
        cxId: appointment.cxId,
        athenaPracticeId: appointment.practiceId,
        athenaPatientId: appointment.patientId,
      };
    }
  );

  await executeAsynchronously(
    syncPatientsArgs,
    async (params: SyncAthenaPatientIntoMetriportParams) => {
      const { error } = await syncPatient(params);
      if (error) syncPatientsErrors.push({ ...params, error });
    },
    {
      numberOfParallelExecutions: parallelPatients,
      delay: delayBetweenPracticeBatches.asMilliseconds(),
    }
  );

  if (syncPatientsErrors.length > 0) {
    const msg = "Failed to sync some patients @ AthenaHealth";
    capture.message(msg, {
      extra: {
        syncPatientsArgsCount: uniqueAppointments.length,
        errorCount: syncPatientsErrors.length,
        errors: syncPatientsErrors,
        context: "athenahealth.process-patients-from-appointments-sub",
      },
      level: "warning",
    });
  }
}

async function getAppointments({
  cxId,
  practiceId,
  departmentIds,
  fromDate,
  toDate,
}: GetAppointmentsParams): Promise<{ appointments?: Appointment[]; error: unknown }> {
  const { log } = out(
    `AthenaHealth getAppointments - cxId ${cxId} practiceId ${practiceId} departmentIds ${departmentIds}`
  );
  const api = await createAthenaClient({ cxId, practiceId });
  try {
    const appointments = await api.getAppointmentsFromSubscription({
      cxId,
      departmentIds,
      startProcessedDate: fromDate,
      endProcessedDate: toDate,
    });
    return {
      appointments: appointments.map(appointment => {
        return { cxId, practiceId, patientId: api.createPatientId(appointment.patientid) };
      }),
      error: undefined,
    };
  } catch (error) {
    log(`Failed to get appointments from ${fromDate} to ${toDate}. Cause: ${errorToString(error)}`);
    return { error };
  }
}

async function syncPatient({
  cxId,
  athenaPracticeId,
  athenaPatientId,
}: Omit<SyncAthenaPatientIntoMetriportParams, "api">): Promise<{ error: unknown }> {
  const { log } = out(
    `AthenaHealth syncPatient - cxId ${cxId} athenaPracticeId ${athenaPracticeId} athenaPatientId ${athenaPatientId}`
  );
  try {
    const payload = JSON.stringify({
      cxId,
      ehrId: EhrSources.athena,
      ehrPracticeId: athenaPracticeId,
      ehrPatientId: athenaPatientId,
    });
    const sqsClient = new SQSClient({ region: Config.getAWSRegion() });
    await sqsClient.sendMessageToQueue(Config.getEhrSyncPatientQueueUrl(), payload, {
      fifo: true,
      messageDeduplicationId: createUuidFromText(payload),
      messageGroupId: cxId,
    });
    return { error: undefined };
  } catch (error) {
    log(`Failed to put sync patient message on queue. Cause: ${errorToString(error)}`);
    return { error };
  }
}
