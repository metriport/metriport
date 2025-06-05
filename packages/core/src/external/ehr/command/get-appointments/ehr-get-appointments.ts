import { SlimBookedAppointment } from "@metriport/shared/interface/external/ehr/canvas/appointment";

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

export type Appointment = SlimBookedAppointment;

export enum AppointmentMethods {
  canvasGetAppointments = "canvasGetAppointments",
}
