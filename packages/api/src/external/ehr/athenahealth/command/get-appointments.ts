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

dayjs.extend(duration);

const delay = dayjs.duration(30, "seconds");

const region = Config.getAWSRegion();
const athenaEnvironment = Config.getAthenaHealthEnv();
const athenaClientKeySecretArn = Config.getAthenaHealthClientKeyArm();
const athenaClientSecretSecretArn = Config.getAthenaHealthClientSecretArn();

export async function getAthenaAppointments(): Promise<void> {
  const { log } = out(`AthenaHealth getAppointments`);
  if (!athenaEnvironment || !athenaClientKeySecretArn || !athenaClientSecretSecretArn) {
    throw new Error("AthenaHealth not setup");
  }
  const cxMappings = await getCxMappings({ source: EhrSources.ATHENA });

  const getAppointmentsWrapperErrors: string[] = [];
  const athenaClientKey = await getSecretValueOrFail(athenaClientKeySecretArn, region);
  const athenaClientSecret = await getSecretValueOrFail(athenaClientSecretSecretArn, region);

  await executeAsynchronously(
    cxMappings.map(mapping => {
      return {
        cxId: mapping.cxId,
        practiceId: mapping.externalId,
        clientKey: athenaClientKey,
        clientSecret: athenaClientSecret,
        errors: getAppointmentsWrapperErrors,
        log,
      };
    }),
    getAppointmentsAndCreateOrUpdatePatient,
    { numberOfParallelExecutions: 10, delay: delay.asMilliseconds() }
  );

  if (getAppointmentsWrapperErrors.length > 0) {
    capture.error("Failed to get appointments", {
      extra: {
        patientCreateCount: getAppointmentsWrapperErrors.length,
        errorCount: getAppointmentsWrapperErrors.length,
        errors: getAppointmentsWrapperErrors.join(","),
        context: "athenahealth.get-appointments",
      },
    });
  }
}

async function getAppointmentsAndCreateOrUpdatePatient({
  cxId,
  practiceId,
  clientKey,
  clientSecret,
  errors,
  log,
}: {
  cxId: string;
  practiceId: string;
  clientKey: string;
  clientSecret: string;
  errors: string[];
  log: typeof console.log;
}): Promise<void> {
  try {
    const api = await AthenaHealthApi.create({
      threeLeggedAuthToken: "",
      practiceId,
      environment: athenaEnvironment as AthenaEnv,
      clientKey,
      clientSecret,
    });
    const end = new Date(new Date().setMinutes(0, 0, 0));
    const start = new Date(end.setHours(end.getHours() - 24));
    const appointments = await api.getAppoitments({ cxId, start, end });
    console.log(appointments);
  } catch (error) {
    const msg = `Failed to get appointments. Cause: ${errorToString(error)}`;
    log(msg);
    errors.push(msg);
  }
}
