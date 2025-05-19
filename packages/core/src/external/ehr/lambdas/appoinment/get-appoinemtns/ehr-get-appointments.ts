import { BadRequestError } from "@metriport/shared";
import { SlimBookedAppointment } from "@metriport/shared/interface/external/ehr/canvas/appointment";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getAppointments as getAppointmentsCanvas } from "../../../canvas/command/get-appointments";

export type GetAppointmentsRequest = {
  ehr: EhrSource;
  cxId: string;
  practiceId: string;
  environment: string;
  fromDate?: Date;
  toDate?: Date;
  tokenId?: string;
  method: AppointmentMethods;
};

export interface EhrGetAppointmentsHandler {
  getAppointments<T>(request: GetAppointmentsRequest): Promise<T[]>;
}

export type GetAppointmentsClientRequest = Omit<GetAppointmentsRequest, "ehr" | "method">;

export enum AppointmentMethods {
  canvasGetAppointments = "canvasGetAppoinemtns",
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
};

export const ehrGetAppointmentsMap: GetAppointmentsMap = {
  [EhrSources.athena]: undefined,
  [EhrSources.elation]: undefined,
  [EhrSources.healthie]: undefined,
  [EhrSources.canvas]: {
    [AppointmentMethods.canvasGetAppointments]: getAppointmentsCanvas,
  },
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
