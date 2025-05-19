import { Config } from "../../../../../util/config";
import { EhrGetAppointmentsHandler } from "./ehr-get-appointments";
import { EhrGetAppointmentsCloud } from "./ehr-get-appointments-cloud";
import { EhrGetAppointmentsLocal } from "./ehr-get-appointments-local";

export function buildEhrGetAppointmentsHandler(): EhrGetAppointmentsHandler {
  if (Config.isDev()) {
    return new EhrGetAppointmentsLocal();
  }
  const ehrGetAppointmentsLambdaName = Config.getEhrGetAppointmentsLambdaName();
  return new EhrGetAppointmentsCloud(ehrGetAppointmentsLambdaName);
}
