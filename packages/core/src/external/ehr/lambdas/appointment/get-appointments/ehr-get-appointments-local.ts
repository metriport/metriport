import {
  EhrGetAppointmentsHandler,
  GetAppointmentsRequest,
  getEhrGetAppointmentsHandler,
} from "./ehr-get-appointments";

export class EhrGetAppointmentsLocal implements EhrGetAppointmentsHandler {
  async getAppointments<T>({ ehr, method, ...params }: GetAppointmentsRequest): Promise<T[]> {
    const handler = getEhrGetAppointmentsHandler<T>(ehr, method);
    return await handler({ ...params });
  }
}
