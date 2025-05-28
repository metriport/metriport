import { BadRequestError } from "@metriport/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getAppointments as getAppointmentsAthena } from "../../athenahealth/command/get-appointments";
import { getAppointmentsFromSubscriptionEvents as getAppointmentsSubscriptionEventsAthena } from "../../athenahealth/command/get-appointments-from-subscription-events";
import { getAppointments as getAppointmentsCanvas } from "../../canvas/command/get-appointments";
import { getAppointments as getAppointmentsElation } from "../../elation/command/get-appointments";
import { getAppointments as getAppointmentsHealthie } from "../../healthie/command/get-appointments";
import {
  EhrGetAppointmentsHandler,
  GetAppointmentsClientRequest,
  GetAppointmentsRequest,
  Appointment,
} from "./ehr-get-appointments";

export class EhrGetAppointmentsDirect implements EhrGetAppointmentsHandler {
  async getAppointments<T extends Appointment>({
    ehr,
    method,
    ...params
  }: GetAppointmentsRequest): Promise<T[]> {
    if (!isAppointmentMethod(method)) {
      throw new BadRequestError(`Invalid appointment method`, undefined, { method });
    }
    const handler = getEhrGetAppointmentsHandler(ehr, method);
    return (await handler({ ...params })) as T[];
  }
}

export enum AppointmentMethods {
  athenaGetAppointments = "athenaGetAppointments",
  athenaGetAppointmentFromSubscriptionEvents = "athenaGetAppointmentFromSubscriptionEvents",
  canvasGetAppointments = "canvasGetAppointments",
  elationGetAppointments = "elationGetAppointments",
  healthieGetAppointments = "healthieGetAppointments",
}

function isAppointmentMethod(method: string): method is AppointmentMethods {
  return Object.values(AppointmentMethods).includes(method as AppointmentMethods);
}

export type AppointmentMethodsMap = Record<
  string,
  Record<string, (params: GetAppointmentsClientRequest) => Promise<Appointment[]>>
>;

export const ehrGetAppointmentsMap: AppointmentMethodsMap = {
  [EhrSources.athena]: {
    [AppointmentMethods.athenaGetAppointments]: getAppointmentsAthena,
    [AppointmentMethods.athenaGetAppointmentFromSubscriptionEvents]:
      getAppointmentsSubscriptionEventsAthena,
  },
  [EhrSources.elation]: {
    [AppointmentMethods.elationGetAppointments]: getAppointmentsElation,
  },
  [EhrSources.healthie]: {
    [AppointmentMethods.healthieGetAppointments]: getAppointmentsHealthie,
  },
  [EhrSources.canvas]: {
    [AppointmentMethods.canvasGetAppointments]: getAppointmentsCanvas,
  },
};

export function getEhrGetAppointmentsHandler(
  ehr: EhrSource,
  method: AppointmentMethods
): (params: GetAppointmentsClientRequest) => Promise<Appointment[]> {
  const handler = ehrGetAppointmentsMap[ehr]?.[method];
  if (!handler) {
    throw new BadRequestError(`No get appointments handler found`, undefined, { ehr, method });
  }
  return handler;
}
