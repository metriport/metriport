import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { buildDayjs } from "@metriport/shared/common/date";
import { executeAsynchronouslyStoreOutput } from "@metriport/core/util/concurrency";
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
const lastModifiedHoursLookback = 72;
const appointmentYearsLookForward = 10;

const region = Config.getAWSRegion();
const athenaEnvironment = Config.getAthenaHealthEnv();
const athenaClientKeySecretArn = Config.getAthenaHealthClientKeyArn();
const athenaClientSecretSecretArn = Config.getAthenaHealthClientSecretArn();

type PatientAppointment = {
  cxId: string;
  athenaPracticeId: string;
  athenaPatientId: string;
};

export async function getPatientIdsOrFailFromAppointments(): Promise<void> {
  const { log } = out(`AthenaHealth getPatientIdsOrFailFromAppointments`);
  if (!athenaEnvironment || !athenaClientKeySecretArn || !athenaClientSecretSecretArn) {
    throw new Error("AthenaHealth not setup");
  }
  const cxMappings = await getCxMappings({ source: EhrSources.athena });

  const currentDatetime = buildDayjs(new Date());
  const startAppointmentDate = buildDayjs(currentDatetime).toDate();
  const endAppointmentDate = buildDayjs(currentDatetime)
    .year(currentDatetime.year() + appointmentYearsLookForward)
    .toDate();
  const startLastModifiedDate = buildDayjs(currentDatetime)
    .hour(currentDatetime.hour() - lastModifiedHoursLookback)
    .toDate();
  const endLastModifiedDate = buildDayjs(currentDatetime).toDate();
  log(`Getting appointments from ${startLastModifiedDate} to ${endLastModifiedDate}`);

  const athenaClientKey = await getSecretValueOrFail(athenaClientKeySecretArn, region);
  const athenaClientSecret = await getSecretValueOrFail(athenaClientSecretSecretArn, region);

  const getAppointmentsOutputs: PatientAppointment[] = [];
  const getAppointmentsErrors: string[] = [];
  const getAppointmentArgs = cxMappings.flatMap(mapping => {
    const cxId = mapping.cxId;
    const practiceId = mapping.externalId;
    const departmentIds = mapping.secondaryMappings?.departmentIds;
    if (!departmentIds || !Array.isArray(departmentIds) || departmentIds.length === 0) {
      log(`Skipping for cxId ${cxId} -- departmentIds missing, malformed or empty`);
      return [];
    }
    return departmentIds.map(departmentId => {
      return {
        cxId,
        practiceId,
        departmentId,
        clientKey: athenaClientKey,
        clientSecret: athenaClientSecret,
        startAppointmentDate,
        endAppointmentDate,
        startLastModifiedDate,
        endLastModifiedDate,
        errors: getAppointmentsErrors,
        log,
      };
    });
  });

  await executeAsynchronouslyStoreOutput(
    getAppointmentArgs,
    getAppointmentsOutputs,
    getAppointmentsErrors,
    "Failed to get appointments",
    getAppointmentsAndCreateOrUpdatePatient,
    { numberOfParallelExecutions: 10, delay: delayBetweenBatches.asMilliseconds() }
  );

  if (getAppointmentsErrors.length > 0) {
    capture.error("Failed to get appointments", {
      extra: {
        patientCreateCount: getAppointmentsErrors.length,
        errorCount: getAppointmentsErrors.length,
        errors: getAppointmentsErrors.join(","),
        context: "athenahealth.get-patients-from-appointments",
      },
    });
  }

  const getPatientIdOrFailOutputs: string[] = [];
  const getPatientIdOrFailErrors: string[] = [];
  const getPatientIdOrFailArgs = getAppointmentsOutputs.map(appointment => {
    return {
      cxId: appointment.cxId,
      athenaPracticeId: appointment.athenaPracticeId,
      athenaPatientId: appointment.athenaPatientId,
      useSearch: true,
      triggerDq: true,

      log,
    };
  });

  await executeAsynchronouslyStoreOutput(
    getPatientIdOrFailArgs,
    getPatientIdOrFailOutputs,
    getPatientIdOrFailErrors,
    "Failed to find or create patients",
    getPatientIdOrFail,
    { numberOfParallelExecutions: 10, delay: delayBetweenBatches.asMilliseconds(), log }
  );

  if (getPatientIdOrFailErrors.length > 0) {
    capture.error("Failed to find or create patients", {
      extra: {
        patientCreateCount: getPatientIdOrFailErrors.length,
        errorCount: getPatientIdOrFailErrors.length,
        errors: getPatientIdOrFailErrors.join(","),
        context: "athenahealth.get-patients-from-appointments",
      },
    });
  }
}

async function getAppointmentsAndCreateOrUpdatePatient({
  cxId,
  practiceId,
  departmentId,
  clientKey,
  clientSecret,
  startAppointmentDate,
  endAppointmentDate,
  startLastModifiedDate,
  endLastModifiedDate,
}: {
  cxId: string;
  practiceId: string;
  departmentId: string;
  clientKey: string;
  clientSecret: string;
  startAppointmentDate: Date;
  endAppointmentDate: Date;
  startLastModifiedDate: Date;
  endLastModifiedDate: Date;
}): Promise<PatientAppointment[]> {
  const api = await AthenaHealthApi.create({
    threeLeggedAuthToken: undefined,
    practiceId,
    environment: athenaEnvironment as AthenaEnv,
    clientKey,
    clientSecret,
  });
  const appointments = await api.getAppointments({
    cxId,
    departmentId,
    startAppointmentDate,
    endAppointmentDate,
    startLastModifiedDate,
    endLastModifiedDate,
  });
  return appointments.appointments.map(appointment => {
    return {
      cxId,
      athenaPracticeId: practiceId,
      athenaPatientId: api.createPatientId(appointment.patientid),
    };
  });
}

async function getPatientIdOrFail({
  cxId,
  athenaPracticeId,
  athenaPatientId,
  accessToken,
  useSearch = false,
  triggerDq = false,
}: {
  cxId: string;
  athenaPracticeId: string;
  athenaPatientId: string;
  accessToken?: string;
  useSearch?: boolean;
  triggerDq?: boolean;
}): Promise<string> {
  return await singleGetPatientIdOrFail({
    cxId,
    athenaPracticeId,
    athenaPatientId,
    accessToken,
    useSearch,
    triggerDq,
  });
}
