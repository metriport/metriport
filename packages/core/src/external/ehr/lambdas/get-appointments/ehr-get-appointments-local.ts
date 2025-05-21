import {
  Appointment,
  EhrGetAppointmentsHandler,
  GetAppointmentsRequest,
  getEhrGetAppointmentsHandler,
} from "./ehr-get-appointments";

export class EhrGetAppointmentsLocal implements EhrGetAppointmentsHandler {
  async getAppointments<T extends Appointment>({
    ehr,
    method,
    ...params
  }: GetAppointmentsRequest): Promise<T[]> {
    const handler = getEhrGetAppointmentsHandler(ehr, method);
    return (await handler({ ...params })) as T[];
  }
}
