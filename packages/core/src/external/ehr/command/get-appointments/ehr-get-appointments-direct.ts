import { BadRequestError } from "@metriport/shared";
import { getAppointments as getAppointmentsCanvas } from "../../canvas/command/get-appointments";
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

type AppointmentMethodsMap = Record<AppointmentMethods, GetAppointments | undefined>;

const ehrGetAppointmentsMap: AppointmentMethodsMap = {
  [AppointmentMethods.canvasGetAppointments]: getAppointmentsCanvas,
};

export function getEhrGetAppointmentsHandler(method: AppointmentMethods): GetAppointments {
  const handler = ehrGetAppointmentsMap[method];
  if (!handler) {
    throw new BadRequestError("No get appointments handler found", undefined, { method });
  }
  return handler;
}
