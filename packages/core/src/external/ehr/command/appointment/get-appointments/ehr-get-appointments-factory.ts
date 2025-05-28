import { Config } from "../../../../../util/config";
import { EhrGetAppointmentsHandler } from "./ehr-get-appointments";
import { EhrGetAppointmentsCloud } from "./ehr-get-appointments-cloud";
import { EhrGetAppointmentsDirect } from "./ehr-get-appointments-direct";

export function buildEhrGetAppointmentsHandler(): EhrGetAppointmentsHandler {
  if (Config.isDev()) {
    return new EhrGetAppointmentsDirect();
  }
  const ehrGetAppointmentsLambdaName = Config.getEhrGetAppointmentsLambdaName();
  return new EhrGetAppointmentsCloud(ehrGetAppointmentsLambdaName);
}
