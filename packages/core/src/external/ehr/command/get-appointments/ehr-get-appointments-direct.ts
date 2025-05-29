import { BadRequestError } from "@metriport/shared";
import { getAppointments as getAppointmentsAthena } from "../../athenahealth/command/get-appointments";
import { getAppointmentsFromSubscriptionEvents as getAppointmentsSubscriptionEventsAthena } from "../../athenahealth/command/get-appointments-from-subscription-events";
import { getAppointments as getAppointmentsCanvas } from "../../canvas/command/get-appointments";
import { getAppointments as getAppointmentsElation } from "../../elation/command/get-appointments";
import { getAppointments as getAppointmentsHealthie } from "../../healthie/command/get-appointments";
import {
  Appointment,
  AppointmentMethods,
  EhrGetAppointmentsHandler,
  GetAppointmentsClientRequest,
  GetAppointmentsRequest,
} from "./ehr-get-appointments";

export class EhrGetAppointmentsDirect implements EhrGetAppointmentsHandler {
  async getAppointments<T extends Appointment>({
    method,
    ...params
  }: GetAppointmentsRequest): Promise<T[]> {
    const handler = getEhrGetAppointmentsHandler(method);
    return (await handler({ ...params })) as T[];
  }
}

type GetAppointments = (params: GetAppointmentsClientRequest) => Promise<Appointment[]>;

export type AppointmentMethodsMap = Record<AppointmentMethods, GetAppointments | undefined>;

export const ehrGetAppointmentsMap: AppointmentMethodsMap = {
  [AppointmentMethods.athenaGetAppointments]: getAppointmentsAthena,
  [AppointmentMethods.athenaGetAppointmentFromSubscriptionEvents]:
    getAppointmentsSubscriptionEventsAthena,
  [AppointmentMethods.elationGetAppointments]: getAppointmentsElation,
  [AppointmentMethods.healthieGetAppointments]: getAppointmentsHealthie,
  [AppointmentMethods.canvasGetAppointments]: getAppointmentsCanvas,
  [AppointmentMethods.eclinicalworksGetAppointments]: undefined,
};

export function getEhrGetAppointmentsHandler(method: AppointmentMethods): GetAppointments {
  const handler = ehrGetAppointmentsMap[method];
  if (!handler) {
    throw new BadRequestError("No get appointments handler found", undefined, { method });
  }
  return handler;
}
