import { BookedAppointment as BookedAppointmentAthena } from "@metriport/shared/interface/external/ehr/athenahealth/appointment";
import { SlimBookedAppointment } from "@metriport/shared/interface/external/ehr/canvas/appointment";
import { BookedAppointment as BookedAppointmentElation } from "@metriport/shared/interface/external/ehr/elation/appointment";
import { AppointmentWithAttendee } from "@metriport/shared/interface/external/ehr/healthie/appointment";

export type GetAppointmentsRequest = {
  method: AppointmentMethods;
  tokenId?: string;
  cxId: string;
  practiceId: string;
  departmentIds?: string[];
  fromDate?: Date;
  toDate?: Date;
};

export type GetAppointmentsClientRequest = Omit<GetAppointmentsRequest, "method">;

export interface EhrGetAppointmentsHandler {
  getAppointments<T extends Appointment>(request: GetAppointmentsRequest): Promise<T[]>;
}

export type Appointment =
  | BookedAppointmentAthena
  | BookedAppointmentElation
  | AppointmentWithAttendee
  | SlimBookedAppointment;

export enum AppointmentMethods {
  athenaGetAppointments = "athenaGetAppointments",
  athenaGetAppointmentFromSubscriptionEvents = "athenaGetAppointmentFromSubscriptionEvents",
  canvasGetAppointments = "canvasGetAppointments",
  elationGetAppointments = "elationGetAppointments",
  healthieGetAppointments = "healthieGetAppointments",
  eclinicalworksGetAppointments = "eclinicalworksGetAppointments",
}
