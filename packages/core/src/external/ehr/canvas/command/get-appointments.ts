import { BadRequestError } from "@metriport/shared";
import { SlimBookedAppointment } from "@metriport/shared/interface/external/ehr/canvas/appointment";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getSecrets } from "../../api/get-client-key-and-secret";
import { getTokenInfo } from "../../api/get-token-info";
import { GetAppointmentsClientRequest } from "../../lambdas/appoinment/get-appoinemtns/ehr-get-appointments";
import CavasApi from "../index";

export async function getAppointments(
  params: GetAppointmentsClientRequest
): Promise<SlimBookedAppointment[]> {
  if (!params.fromDate) {
    throw new BadRequestError("fromDate is required", undefined, {
      ehr: EhrSources.canvas,
      cxId: params.cxId,
      practiceId: params.practiceId,
    });
  }
  if (!params.toDate) {
    throw new BadRequestError("toDate is required", undefined, {
      ehr: EhrSources.canvas,
      cxId: params.cxId,
      practiceId: params.practiceId,
    });
  }
  const twoLeggedAuthTokenInfo = await getTokenInfo(params.tokenId);
  const client = await CavasApi.create({
    twoLeggedAuthTokenInfo,
    practiceId: params.practiceId,
    environment: params.environment,
    getSecrets: async () => {
      return getSecrets({
        ehr: EhrSources.canvas,
        cxId: params.cxId,
        practiceId: params.practiceId,
      });
    },
  });
  const appointments = await client.getAppointments({
    cxId: params.cxId,
    fromDate: params.fromDate,
    toDate: params.toDate,
  });
  return appointments;
}
