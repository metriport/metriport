import { BookedAppointment as BookedAppointmentAthena } from "@metriport/shared/interface/external/ehr/athenahealth/appointment";
import { SlimBookedAppointment } from "@metriport/shared/interface/external/ehr/canvas/appointment";
import { BookedAppointment as BookedAppointmentElation } from "@metriport/shared/interface/external/ehr/elation/appointment";
import { AppointmentWithAttendee } from "@metriport/shared/interface/external/ehr/healthie/appointment";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";

export type GetAppointmentsRequest = {
  ehr: EhrSource;
  method: string;
  tokenId?: string;
  cxId: string;
  practiceId: string;
  departmentIds?: string[];
  fromDate?: Date;
  toDate?: Date;
};

export type GetAppointmentsClientRequest = Omit<GetAppointmentsRequest, "ehr" | "method">;

export interface EhrGetAppointmentsHandler {
  getAppointments<T extends Appointment>(request: GetAppointmentsRequest): Promise<T[]>;
}

export type Appointment =
  | BookedAppointmentAthena
  | BookedAppointmentElation
  | AppointmentWithAttendee
  | SlimBookedAppointment;
