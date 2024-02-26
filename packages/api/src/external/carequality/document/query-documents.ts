import { Patient } from "@metriport/core/domain/patient";
import { makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { MedicalDataSource } from "@metriport/core/external/index";
import { errorToString } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { getOrganizationOrFail } from "../../../command/medical/organization/get-organization";
import { processAsyncError } from "../../../errors";
import { Config } from "../../../shared/config";
import { isCQDirectEnabledForCx } from "../../aws/appConfig";
import { resetDocQueryProgress } from "../../hie/reset-doc-query-progress";
import { setDocQueryProgress } from "../../hie/set-doc-query-progress";
import { makeIheGatewayAPIForDocQuery } from "../../ihe-gateway/api";
import { getCQPatientData } from "../command/cq-patient-data/get-cq-data";
import { createOutboundDocumentQueryRequests } from "./create-outbound-document-query-req";

const region = Config.getAWSRegion();
const lambdaClient = makeLambdaClient(region);
const lambdaName = Config.getOutboundDocumentQueryLambdaName();
const iheGateway = makeIheGatewayAPIForDocQuery();

export async function getDocumentsFromCQ({
  requestId,
  patient,
}: {
  requestId: string;
  patient: Patient;
}) {
  const { log } = out(`CQ DQ - requestId ${requestId}, patient ${patient.id}`);
  const { cxId, id: patientId } = patient;

  const interrupt = buildInterrupt({ patientId, cxId, log });
  if (!iheGateway) return interrupt(`IHE GW not available`);
  if (!lambdaName) return interrupt(`IHE DR lambda not available`);
  if (!(await isCQDirectEnabledForCx(cxId))) return interrupt(`CQ disabled for cx ${cxId}`);

  try {
    const [organization, cqPatientData] = await Promise.all([
      getOrganizationOrFail({ cxId }),
      getCQPatientData({ id: patient.id, cxId }),
    ]);

    if (!cqPatientData || cqPatientData.data.links.length <= 0) {
      return interrupt(`Patient has no CQ links, skipping DQ`);
    }

    const documentQueryRequests = createOutboundDocumentQueryRequests({
      requestId,
      cxId: patient.cxId,
      organization,
      cqLinks: cqPatientData?.data.links ?? [],
    });

    // We send the request to IHE Gateway to initiate the doc query.
    // Then as they are processed by each gateway it will start
    // sending them to the internal route one by one
    log(`Starting document query`);
    await iheGateway.startDocumentsQuery({ outboundDocumentQueryReq: documentQueryRequests });

    // This lambda polls for the results from the IHE Gateway and process them.
    // Intentionally asynchronous.
    lambdaClient
      .invoke({
        FunctionName: lambdaName,
        InvocationType: "Event",
        Payload: JSON.stringify({
          requestId,
          patientId: patient.id,
          cxId: patient.cxId,
          numOfGateways: documentQueryRequests.length,
        }),
      })
      .promise()
      .catch(
        processAsyncError("Failed to invoke lambda to process outbound document query responses.")
      );
  } catch (error) {
    const msg = `Failed to query and process documents - Carequality`;
    log(`${msg}. Error: ${errorToString(error)}`);

    await setDocQueryProgress({
      patient: { id: patient.id, cxId: patient.cxId },
      downloadProgress: { status: "failed" },
      requestId,
      source: MedicalDataSource.CAREQUALITY,
    });

    capture.error(msg, {
      extra: {
        context: `cq.queryAndProcessDocuments`,
        error,
        patientId: patient.id,
        requestId,
      },
    });
    throw error;
  }
}

function buildInterrupt({
  patientId,
  cxId,
  log,
}: {
  patientId: string;
  cxId: string;
  log: typeof console.log;
}) {
  return async (reason: string): Promise<void> => {
    log(reason + ", skipping DQ");
    await resetDocQueryProgress({
      patient: { id: patientId, cxId },
      source: MedicalDataSource.CAREQUALITY,
    });
  };
}
