import { makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { errorToString } from "@metriport/core/util/error/shared";
import { capture } from "@metriport/core/util/notifications";
import { Patient } from "@metriport/core/domain/patient";
import { Config } from "../../../shared/config";
import { createCQDocumentQueryRequests } from "./document-query-request";
import { getOrganizationOrFail } from "../../../command/medical/organization/get-organization";
import { makeIheGatewayAPI } from "../api";
import { MedicalDataSource } from "@metriport/core/external/index";
import { getCQPatientData } from "../command/cq-patient-data/get-cq-data";
import { setDocQueryProgress } from "../../hie/set-doc-query-progress";
import { processAsyncError } from "../../../errors";

const region = Config.getAWSRegion();
const lambdaClient = makeLambdaClient(region);
const iheGateway = makeIheGatewayAPI();
const lambdaName = Config.getDocQueryResultsLambdaName();

export async function getDocumentsFromCQ({
  requestId,
  patient,
}: {
  requestId: string;
  patient: Patient;
}) {
  if (!iheGateway) return;

  try {
    const organization = await getOrganizationOrFail({ cxId: patient.cxId });
    const cqPatientData = await getCQPatientData({ id: patient.id, cxId: patient.cxId });

    const documentQueryRequests = createCQDocumentQueryRequests({
      requestId,
      cxId: patient.cxId,
      organization,
      cqLinks: cqPatientData?.data.links ?? [],
    });

    // We send the request to IHE Gateway to initiate the doc query.
    // Then as they are processed by each gateway it will start
    // sending them to the internal route one by one
    await iheGateway.startDocumentsQuery({ documentQueryReqToExternalGW: documentQueryRequests });

    // We invoke the lambda that will start polling for the results
    // from the IHE Gateway and process them
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
      .catch(processAsyncError(`cq.invokeDocRetrievalResultsLambda`));
  } catch (error) {
    const msg = `Failed to query and process documents - Carequality.`;
    console.log(`${msg}. Error: ${errorToString(error)}`);

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
