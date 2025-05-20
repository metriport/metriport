import { BadRequestError } from "@metriport/shared";
import { SlimBookedAppointment } from "@metriport/shared/interface/external/ehr/canvas/appointment";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getSecrets } from "../../api/get-client-key-and-secret";
import { getTokenInfo } from "../../api/get-token-info";
import { GetAppointmentsClientRequest } from "../../lambdas/appointment/get-appointments/ehr-get-appointments";
import { GetSecretsOauthResult, getSecretsOauthSchema } from "../../shared";
import CanvasApi from "../index";

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
  const client = await CanvasApi.create({
    twoLeggedAuthTokenInfo,
    practiceId: params.practiceId,
    environment: params.environment,
    getSecrets: async () => {
      const secrets = await getSecrets<GetSecretsOauthResult>({
        ehr: EhrSources.canvas,
        cxId: params.cxId,
        practiceId: params.practiceId,
        schema: getSecretsOauthSchema,
      });
      return {
        clientKey: secrets.clientKey,
        clientSecret: secrets.clientSecret,
      };
    },
  });
  const appointments = await client.getAppointments({
    cxId: params.cxId,
    fromDate: params.fromDate,
    toDate: params.toDate,
  });
  return appointments;
}
