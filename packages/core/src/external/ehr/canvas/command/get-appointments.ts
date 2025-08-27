import { BadRequestError } from "@metriport/shared";
import { SlimBookedAppointment } from "@metriport/shared/interface/external/ehr/canvas/appointment";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { GetAppointmentsClientRequest } from "../../command/get-appointments/ehr-get-appointments";
import { createCanvasClient } from "../shared";

export async function getAppointments(
  params: GetAppointmentsClientRequest
): Promise<SlimBookedAppointment[]> {
  const { cxId, practiceId, fromDate, toDate } = params;
  if (!fromDate || !toDate) {
    throw new BadRequestError("fromDate and toDate are required", undefined, {
      method: "getAppointments",
      ehr: EhrSources.canvas,
      cxId,
      practiceId,
      fromDate: fromDate?.toISOString(),
      toDate: toDate?.toISOString(),
    });
  }
  const client = await createCanvasClient({ cxId, practiceId });
  const appointments = await client.getAppointments({ cxId, fromDate, toDate });
  return appointments;
}
