import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { errorToString } from "@metriport/shared";
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

const delay = dayjs.duration(30, "seconds");
const appointmenDaysLookback = 2;

const region = Config.getAWSRegion();
const athenaEnvironment = Config.getAthenaHealthEnv();
const athenaClientKeySecretArn = Config.getAthenaHealthClientKeyArm();
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
  const cxMappings = await getCxMappings({ source: EhrSources.ATHENA });

  const patientAppointments: PatientAppointment[] = [];
  const getAppointmentsErrors: string[] = [];
  const athenaClientKey = await getSecretValueOrFail(athenaClientKeySecretArn, region);
  const athenaClientSecret = await getSecretValueOrFail(athenaClientSecretSecretArn, region);

  const now = new Date();
  const dayUTCSeconds = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dayUTCDate = new Date(dayUTCSeconds);
  const end = new Date(dayUTCDate);
  const start = new Date(dayUTCDate.setHours(dayUTCDate.getHours() - appointmenDaysLookback * 24));
  log(`Getting appointments from ${start} to ${end}`);

  await executeAsynchronously(
    cxMappings.flatMap(mapping => {
      const cxId = mapping.cxId;
      const practiceId = mapping.externalId;
      const departmentIds = mapping.secondaryMappings.departmentIds;
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
          patientAppointments,
          start,
          end,
          errors: getAppointmentsErrors,
          log,
        };
      });
    }),
    getAppointmentsAndCreateOrUpdatePatient,
    { numberOfParallelExecutions: 10, delay: delay.asMilliseconds() }
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

  const getPatientOrFailErrors: string[] = [];

  await executeAsynchronously(
    patientAppointments.map(appointment => {
      return {
        cxId: appointment.cxId,
        athenaPracticeId: appointment.athenaPracticeId,
        athenaPatientId: appointment.athenaPatientId,
        useSearch: true,
        triggerDq: true,
        errors: getPatientOrFailErrors,
        log,
      };
    }),
    getPatientIdOrFail,
    { numberOfParallelExecutions: 10, delay: delay.asMilliseconds() }
  );

  if (getPatientOrFailErrors.length > 0) {
    capture.error("Failed to find or create patients", {
      extra: {
        patientCreateCount: getPatientOrFailErrors.length,
        errorCount: getPatientOrFailErrors.length,
        errors: getPatientOrFailErrors.join(","),
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
  patientAppointments,
  start,
  end,
  errors,
  log,
}: {
  cxId: string;
  practiceId: string;
  departmentId: string;
  clientKey: string;
  clientSecret: string;
  patientAppointments: PatientAppointment[];
  start: Date;
  end: Date;
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
    const appointments = await api.getAppointments({ cxId, departmentId, start, end });
    patientAppointments.push(
      ...appointments.appointments.map(appointment => {
        return { cxId, athenaPracticeId: practiceId, athenaPatientId: appointment.patientid };
      })
    );
  } catch (error) {
    const msg = `Failed to get appointments. Cause: ${errorToString(error)}`;
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
    const msg = `Failed to find or create patients. Cause: ${errorToString(error)}`;
    log(msg);
    errors.push(msg);
  }
}
