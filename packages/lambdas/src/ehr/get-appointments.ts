import { GetAppointmentsRequest } from "@metriport/core/external/ehr/command/get-appointments/ehr-get-appointments";
import { EhrGetAppointmentsDirect } from "@metriport/core/external/ehr/command/get-appointments/ehr-get-appointments-direct";
import { capture } from "../shared/capture";
import { getEnvOrFail } from "../shared/env";
import { prefixedLog } from "../shared/log";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");

type GetAppointmentsRequestInLambda = Omit<GetAppointmentsRequest, "fromDate" | "toDate"> & {
  fromDate?: string;
  toDate?: string;
};

export const handler = capture.wrapHandler(async (params: GetAppointmentsRequestInLambda) => {
  capture.setExtra({ params, context: lambdaName });
  const { cxId, practiceId, method } = params;

  const startedAt = new Date().getTime();

  const log = prefixedLog(`method ${method}, cxId ${cxId}, practiceId ${practiceId}`);

  const ehrGetAppointmentsHandler = new EhrGetAppointmentsDirect();
  const appointments = await ehrGetAppointmentsHandler.getAppointments(
    convertToGetAppointmentsRequest(params)
  );

  const finishedAt = new Date().getTime();
  log(`Done local duration: ${finishedAt - startedAt}ms`);
  return appointments;
});

function convertToGetAppointmentsRequest(
  params: GetAppointmentsRequestInLambda
): GetAppointmentsRequest {
  return {
    ...params,
    fromDate: params.fromDate ? new Date(params.fromDate) : undefined,
    toDate: params.toDate ? new Date(params.toDate) : undefined,
  };
}
