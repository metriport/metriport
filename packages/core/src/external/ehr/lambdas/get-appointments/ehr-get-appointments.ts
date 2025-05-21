import { BadRequestError } from "@metriport/shared";
import { BookedAppointment as BookedAppointmentAthena } from "@metriport/shared/interface/external/ehr/athenahealth/appointment";
import { SlimBookedAppointment } from "@metriport/shared/interface/external/ehr/canvas/appointment";
import { BookedAppointment as BookedAppointmentElation } from "@metriport/shared/interface/external/ehr/elation/appointment";
import { AppointmentAttendee } from "@metriport/shared/interface/external/ehr/healthie/appointment";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getAppointments as getAppointmentsAthena } from "../../athenahealth/command/get-appointments";
import { getAppointmentsFromSubscriptionEvents as getAppointmentsSubscriptionEventsAthena } from "../../athenahealth/command/get-appointments-from-subscription-events";
import { getAppointments as getAppointmentsCanvas } from "../../canvas/command/get-appointments";
import { getAppointments as getAppointmentsElation } from "../../elation/command/get-appointments";
import { getAppointments as getAppointmentsHealthie } from "../../healthie/command/get-appointments";

export type GetAppointmentsRequest = {
  ehr: EhrSource;
  environment: string;
  method: AppointmentMethods;
  tokenId?: string;
  cxId: string;
  practiceId: string;
  departmentIds?: string[];
  fromDate?: Date;
  toDate?: Date;
};

export interface EhrGetAppointmentsHandler {
  getAppointments<T extends Appointment>(request: GetAppointmentsRequest): Promise<T[]>;
}

export type GetAppointmentsClientRequest = Omit<GetAppointmentsRequest, "ehr" | "method">;

export enum AppointmentMethods {
  athenaGetAppointments = "athenaGetAppointments",
  athenaGetAppointmentFromSubscriptionEvents = "athenaGetAppointmentFromSubscriptionEvents",
  canvasGetAppointments = "canvasGetAppointments",
  elationGetAppointments = "elationGetAppointments",
  healthieGetAppointments = "healthieGetAppointments",
}

export type Appointment =
  | BookedAppointmentAthena
  | BookedAppointmentElation
  | AppointmentAttendee
  | SlimBookedAppointment;

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
