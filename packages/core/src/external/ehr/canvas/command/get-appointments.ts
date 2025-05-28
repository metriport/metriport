import { BadRequestError } from "@metriport/shared";
import { SlimBookedAppointment } from "@metriport/shared/interface/external/ehr/canvas/appointment";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { GetAppointmentsClientRequest } from "../../command/appointment/get-appointments/ehr-get-appointments";
import { createCanvasClient } from "../shared";

export async function getAppointments(
  params: GetAppointmentsClientRequest
): Promise<SlimBookedAppointment[]> {
  const { cxId, practiceId, fromDate, toDate, environment, tokenId } = params;
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
  const client = await createCanvasClient({
    environment,
    cxId,
    practiceId,
    ...(tokenId && { tokenId }),
  });
  const appointments = await client.getAppointments({ cxId, fromDate, toDate });
  return appointments;
}
