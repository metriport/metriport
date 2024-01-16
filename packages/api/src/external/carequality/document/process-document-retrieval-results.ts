import { out } from "@metriport/core/util/log";
import { errorToString } from "@metriport/core/util/error/index";
import { capture } from "@metriport/core/util/notifications";
import { DocumentReference } from "@metriport/ihe-gateway-sdk";
import { DocumentRetrievalResult } from "../document-retrieval-result";
import { isConvertible } from "../../fhir-converter/converter";
import { MedicalDataSource } from "../../../external";
import { appendDocQueryProgressWithSource } from "../../hie/append-doc-query-progress-with-source";
import { mapDocRefToMetriport } from "../../../shared/external";
import { DocumentWithMetriportId } from "../../../external/carequality/document/shared";
import { getNonExistentDocRefs } from "./get-non-existent-doc-refs";

export async function processDocumentRetrievalResults({
  requestId,
  patientId,
  cxId,
  documentRetrievalResults,
}: {
  requestId: string;
  patientId: string;
  cxId: string;
  documentRetrievalResults: DocumentRetrievalResult[];
}): Promise<void> {
  // I need to convert CDA to FHIR
  // Store doc reference in FHIR
  // How many errors were there when downloading and sending the s3?

  const { log } = out(`CQ retrieval docs - requestId ${requestId}, M patient ${patientId}`);

  try {
    for (const result of documentRetrievalResults) {
      // how do i know how many issues there are?
    }
  } catch (error) {
    const msg = `Failed to process documents in Carequality.`;
    console.log(`${msg}. Error: ${errorToString(error)}`);

    await appendDocQueryProgressWithSource({
      patient: { id: patientId, cxId: cxId },
      downloadProgress: { status: "failed" },
      requestId,
      source: MedicalDataSource.CAREQUALITY,
    });

    capture.message(msg, {
      extra: {
        context: `cq.processingDocuments`,
        error,
        patientId: patientId,
        requestId,
        cxId,
      },
      level: "error",
    });
    throw error;
  }
}
