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
import { getPatientIdOrFail } from "./get-patient";

dayjs.extend(duration);

const delay = dayjs.duration(30, "seconds");
const appointmentHoursLookback = 48;

const region = Config.getAWSRegion();
const athenaEnvironment = Config.getAthenaHealthEnv();
const athenaClientKeySecretArn = Config.getAthenaHealthClientKeyArm();
const athenaClientSecretSecretArn = Config.getAthenaHealthClientSecretArn();

type PatientAppointment = {
  cxId: string;
  athenaPracticeId: string;
  athenaPatientId: string;
};

export async function getAthenaAppointments(): Promise<void> {
  const { log } = out(`AthenaHealth getAppointments`);
  if (!athenaEnvironment || !athenaClientKeySecretArn || !athenaClientSecretSecretArn) {
    throw new Error("AthenaHealth not setup");
  }
  const cxMappings = await getCxMappings({ source: EhrSources.ATHENA });

  const patientAppointments: PatientAppointment[] = [];
  const getAppointmentsErrors: string[] = [];
  const athenaClientKey = await getSecretValueOrFail(athenaClientKeySecretArn, region);
  const athenaClientSecret = await getSecretValueOrFail(athenaClientSecretSecretArn, region);

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
        context: "athenahealth.get-appointments",
      },
    });
  }

  await executeAsynchronously(
    patientAppointments.map(appointment => {
      return {
        cxId: appointment.cxId,
        athenaPracticeId: appointment.athenaPracticeId,
        athenaPatientId: appointment.athenaPatientId,
        useSearch: true,
        triggerDq: true,
      };
    }),
    getPatientIdOrFailVoid,
    { numberOfParallelExecutions: 10, delay: delay.asMilliseconds() }
  );
}

async function getAppointmentsAndCreateOrUpdatePatient({
  cxId,
  practiceId,
  departmentId,
  clientKey,
  clientSecret,
  patientAppointments,
  errors,
  log,
}: {
  cxId: string;
  practiceId: string;
  departmentId: string;
  clientKey: string;
  clientSecret: string;
  patientAppointments: PatientAppointment[];
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
    const now = new Date(new Date().setMinutes(0, 0, 0));
    const end = new Date(now);
    const start = new Date(now.setHours(now.getHours() - appointmentHoursLookback));
    const appointments = await api.getAppointments({ cxId, departmentId, start, end });
    patientAppointments.push(
      ...appointments.appointments.map(appointment => {
        return { cxId, athenaPracticeId: practiceId, athenaPatientId: appointment.patientid };
      })
    );
  } catch (error) {
    const msg = `Failed to get appointments and find or create patients. Cause: ${errorToString(
      error
    )}`;
    log(msg);
    errors.push(msg);
  }
}

async function getPatientIdOrFailVoid({
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
}): Promise<void> {
  await getPatientIdOrFail({
    cxId,
    athenaPracticeId,
    athenaPatientId,
    accessToken,
    useSearch,
    triggerDq,
  });
}
