import { makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { errorToString } from "@metriport/core/util/error/index";
import { capture } from "@metriport/core/util/notifications";
import { Patient } from "../../../domain/medical/patient";
import { Config } from "../../../shared/config";
import { appendDocQueryProgress } from "../../../command/medical/patient/append-doc-query-progress";
import { createCQDocumentQueryRequest } from "./document-query-request";
import { getOrganizationOrFail } from "../../../command/medical/organization/get-organization";
import { makeIheGatewayAPI } from "../api";
import { MedicalDataSource } from "../../../external";
import { getCQPatientData } from "../command/cq-patient-data/get-cq-data";

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

    const documentQueryRequest = createCQDocumentQueryRequest({
      requestId,
      cxId: patient.cxId,
      organization,
      cqLinks: cqPatientData?.data.links ?? [],
    });

    await iheGateway.startDocumentsQuery({ documentQueryRequest });

    await lambdaClient
      .invoke({
        FunctionName: lambdaName,
        InvocationType: "Event",
        Payload: JSON.stringify({
          requestId,
          patientId: patient.id,
          cxId: patient.cxId,
          numOfLinks: documentQueryRequest.length,
        }),
      })
      .promise();
  } catch (error) {
    const msg = `Failed to query and process documents in Carequality.`;
    console.log(`${msg}. Error: ${errorToString(error)}`);

    await appendDocQueryProgress({
      patient: { id: patient.id, cxId: patient.cxId },
      downloadProgress: { status: "failed" },
      requestId,
      source: MedicalDataSource.CAREQUALITY,
    });

    capture.message(msg, {
      extra: {
        context: `cq.queryAndProcessDocuments`,
        error,
        patientId: patient.id,
        requestId,
      },
      level: "error",
    });
    throw error;
  }
}
