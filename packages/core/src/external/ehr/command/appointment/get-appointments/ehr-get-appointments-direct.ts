import { BadRequestError } from "@metriport/shared";
import { SlimBookedAppointment } from "@metriport/shared/interface/external/ehr/canvas/appointment";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getAppointments as getAppointmentsCanvas } from "../../../canvas/command/get-appointments";
import {
  EhrGetAppointmentsHandler,
  GetAppointmentsClientRequest,
  GetAppointmentsRequest,
} from "./ehr-get-appointments";

export class EhrGetAppointmentsDirect implements EhrGetAppointmentsHandler {
  async getAppointments<T>({ ehr, method, ...params }: GetAppointmentsRequest): Promise<T[]> {
    if (!isAppointmentMethod(method)) {
      throw new BadRequestError(`Invalid appointment method`, undefined, { method });
    }
    const handler = getEhrGetAppointmentsHandler<T>(ehr, method);
    return await handler({ ...params });
  }
}

export enum AppointmentMethods {
  canvasGetAppointments = "canvasGetAppointments",
}

function isAppointmentMethod(method: string): method is AppointmentMethods {
  return Object.values(AppointmentMethods).includes(method as AppointmentMethods);
}

export type GetAppointmentsMap = {
  [EhrSources.athena]: undefined;
  [EhrSources.elation]: undefined;
  [EhrSources.healthie]: undefined;
  [EhrSources.canvas]: {
    [AppointmentMethods.canvasGetAppointments]: (
      params: GetAppointmentsClientRequest
    ) => Promise<SlimBookedAppointment[]>;
  };
  [EhrSources.eclinicalworks]: undefined;
};

export const ehrGetAppointmentsMap: GetAppointmentsMap = {
  [EhrSources.athena]: undefined,
  [EhrSources.elation]: undefined,
  [EhrSources.healthie]: undefined,
  [EhrSources.canvas]: {
    [AppointmentMethods.canvasGetAppointments]: getAppointmentsCanvas,
  },
  [EhrSources.eclinicalworks]: undefined,
};

export function getEhrGetAppointmentsHandler<T>(
  ehr: EhrSource,
  method: AppointmentMethods
): (params: GetAppointmentsClientRequest) => Promise<T[]> {
  const handler = ehrGetAppointmentsMap[ehr]?.[method];
  if (!handler) {
    throw new BadRequestError(`No get appointments handler found`, undefined, { ehr, method });
  }
  return handler as (params: GetAppointmentsClientRequest) => Promise<T[]>;
}
