import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { errorToString } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import AthenaHealthApi, { AthenaEnv } from "@metriport/core/external/athenahealth/index";
import { EhrSources } from "../../shared";
import { getCxMappings } from "../../../../command/mapping/cx";
import { getSecretValueOrFail } from "@metriport/core/external/aws/secret-manager";
import { Config } from "../../../../shared/config";
import { getPatientIdOrFail as singleGetPatientIdOrFail } from "./get-patient";

dayjs.extend(duration);

const delayBetweenBatches = dayjs.duration(30, "seconds");
const lastModifiedHoursLookback = 12;

const region = Config.getAWSRegion();
const athenaEnvironment = Config.getAthenaHealthEnv();
const athenaClientKeySecretArn = Config.getAthenaHealthClientKeyArn();
const athenaClientSecretSecretArn = Config.getAthenaHealthClientSecretArn();

type PatientAppointment = {
  cxId: string;
  athenaPracticeId: string;
  athenaPatientId: string;
};

export async function getPatientIdsOrFailFromAppointmentsSub({
  catchUp,
}: {
  catchUp: boolean;
}): Promise<void> {
  const { log } = out(`AthenaHealth getPatientIdsOrFailFromAppointmentsSub`);
  if (!athenaEnvironment || !athenaClientKeySecretArn || !athenaClientSecretSecretArn) {
    throw new Error("AthenaHealth not setup");
  }
  const cxMappings = await getCxMappings({ source: EhrSources.athena });
  const athenaClientKey = await getSecretValueOrFail(athenaClientKeySecretArn, region);
  const athenaClientSecret = await getSecretValueOrFail(athenaClientSecretSecretArn, region);

  const currentDatetime = buildDayjs(new Date());
  const startLastModifiedDate = buildDayjs(currentDatetime)
    .hour(currentDatetime.hour() - lastModifiedHoursLookback)
    .toDate();
  const endLastModifiedDate = buildDayjs(currentDatetime).toDate();
  if (catchUp) {
    log(`Getting appointments from ${startLastModifiedDate} to ${endLastModifiedDate}`);
  } else {
    log(`Getting appointments since last run`);
  }

  const patientAppointments: PatientAppointment[] = [];
  const getAppointmentsErrors: string[] = [];
  const getAppointmentsArgs = cxMappings.flatMap(mapping => {
    const practiceId = mapping.externalId;
    const departmentIds = mapping.secondaryMappings?.departmentIds;
    if (departmentIds && !Array.isArray(departmentIds)) {
      throw new Error(
        `departmentIds exists but is malformed for cxId ${mapping.cxId} practiceId ${practiceId}`
      );
    }
    return {
      cxId: mapping.cxId,
      practiceId,
      departmentIds,
      clientKey: athenaClientKey,
      clientSecret: athenaClientSecret,
      patientAppointments,
      startLastModifiedDate: catchUp ? startLastModifiedDate : undefined,
      endLastModifiedDate: catchUp ? endLastModifiedDate : undefined,
      errors: getAppointmentsErrors,
      log,
    };
  });

  await executeAsynchronously(getAppointmentsArgs, getAppointmentsFromSubAndCreateOrUpdatePatient, {
    numberOfParallelExecutions: 10,
    delay: delayBetweenBatches.asMilliseconds(),
  });

  if (getAppointmentsErrors.length > 0) {
    capture.error("Failed to get appointments", {
      extra: {
        getAppointmentsArgsCount: getAppointmentsArgs.length,
        errorCount: getAppointmentsErrors.length,
        errors: getAppointmentsErrors.join(","),
        context: "athenahealth.get-patients-from-appointments-sub",
      },
    });
  }

  const patientAppointmentsUnique = [
    ...new Map(patientAppointments.map(app => [app.athenaPatientId, app])).values(),
  ];
  const getPatientIdOrFailErrors: string[] = [];
  const getPatientIdOrFaiLArgs = patientAppointmentsUnique.map(appointment => {
    return {
      cxId: appointment.cxId,
      athenaPracticeId: appointment.athenaPracticeId,
      athenaPatientId: appointment.athenaPatientId,
      useSearch: true,
      triggerDq: true,
      errors: getPatientIdOrFailErrors,
      log,
    };
  });

  await executeAsynchronously(getPatientIdOrFaiLArgs, getPatientIdOrFail, {
    numberOfParallelExecutions: 10,
    delay: delayBetweenBatches.asMilliseconds(),
  });

  if (getPatientIdOrFailErrors.length > 0) {
    capture.error("Failed to find or create patients", {
      extra: {
        getPatientIdOrFaiLArgsCount: getPatientIdOrFaiLArgs.length,
        errorCount: getPatientIdOrFailErrors.length,
        errors: getPatientIdOrFailErrors.join(","),
        context: "athenahealth.get-patients-from-appointments",
      },
    });
  }
}

async function getAppointmentsFromSubAndCreateOrUpdatePatient({
  cxId,
  practiceId,
  departmentIds,
  clientKey,
  clientSecret,
  patientAppointments,
  startLastModifiedDate,
  endLastModifiedDate,
  errors,
  log,
}: {
  cxId: string;
  practiceId: string;
  departmentIds?: string[];
  clientKey: string;
  clientSecret: string;
  patientAppointments: PatientAppointment[];
  startLastModifiedDate?: Date;
  endLastModifiedDate?: Date;
  errors: string[];
  log: typeof console.log;
}): Promise<void> {
  try {
    const api = await AthenaHealthApi.create({
      threeLeggedAuthToken: undefined,
      practiceId,
      environment: athenaEnvironment as AthenaEnv,
      clientKey,
      clientSecret,
    });
    const appointments = await api.getAppointmentsFromSubscription({
      cxId,
      departmentIds,
      startLastModifiedDate,
      endLastModifiedDate,
    });
    patientAppointments.push(
      ...appointments.map(appointment => {
        return {
          cxId,
          athenaPracticeId: practiceId,
          athenaPatientId: api.createPatientId(appointment.patientid),
        };
      })
    );
  } catch (error) {
    const msg = `Failed to get appointments. cxId ${cxId} practiceId ${practiceId} departmentIds ${departmentIds}. Cause: ${errorToString(
      error
    )}`;
    log(msg);
    errors.push(msg);
  }
}

async function getPatientIdOrFail({
  cxId,
  athenaPracticeId,
  athenaPatientId,
  accessToken,
  useSearch = false,
  triggerDq = false,
  errors,
  log,
}: {
  cxId: string;
  athenaPracticeId: string;
  athenaPatientId: string;
  accessToken?: string;
  useSearch?: boolean;
  triggerDq?: boolean;
  errors: string[];
  log: typeof console.log;
}): Promise<void> {
  try {
    await singleGetPatientIdOrFail({
      cxId,
      athenaPracticeId,
      athenaPatientId,
      accessToken,
      useSearch,
      triggerDq,
    });
  } catch (error) {
    const msg = `Failed to find or create patients. cxId ${cxId} athenaPracticeId ${athenaPracticeId} athenaPatientId ${athenaPatientId}. Cause: ${errorToString(
      error
    )}`;
    log(msg);
    errors.push(msg);
  }
}
