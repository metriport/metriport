import { completePatientStateConversion } from "@metriport/core/command/patient-state/conversion/complete";
import { GetConversionParams } from "@metriport/core/command/patient-state/conversion/types";
import { updatePatientStateWithConversionResponse } from "@metriport/core/command/patient-state/conversion/update";
import { ConvertResult } from "@metriport/core/domain/document-query";
import { MedicalDataSource } from "@metriport/core/external";
import { isConditionalCheckFailedError } from "@metriport/core/external/aws/dynamodb";
import { capture } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { errorToString } from "@metriport/shared/common/error";
import { recreateConsolidated } from "../../../command/medical/patient/consolidated-recreate";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { processAsyncError } from "../../../errors";

export async function handleEhexConversionStatus({
  patientId,
  cxId,
  requestId,
  docId,
  convertResult,
  details,
  count: countParam,
}: {
  patientId: string;
  cxId: string;
  requestId: string;
  docId: string;
  convertResult: ConvertResult;
  details?: string;
  count?: number;
}): Promise<void> {
  const { log } = out(
    `EHEX conversion status - patient ${patientId}, requestId ${requestId}, docId ${docId}`
  );
  const count = countParam ?? 1;
  const success = convertResult === "success";

  log(`Conversion result: ${convertResult}, count: ${count}, details: ${details ?? "none"}`);

  try {
    const conversionState = await updatePatientStateWithConversionResponse({
      patientId,
      cxId,
      network: MedicalDataSource.EHEX,
      requestId,
      success,
      count,
    });

    if (shouldCompleteConversion(conversionState)) {
      log(
        `Conversion complete: ${conversionState.totalConverted} converted, ` +
          `${conversionState.totalErrors} errors out of ${conversionState.totalToConvert} total`
      );

      try {
        const getPatientPromise = getPatientOrFail({ id: patientId, cxId });
        const pdStateUpdatePromise = completePatientStateConversion({
          cxId,
          patientId,
          network: MedicalDataSource.EHEX,
          requestId,
        });
        const [patient] = await Promise.all([getPatientPromise, pdStateUpdatePromise]);

        // intentionally async
        recreateConsolidated({
          patient,
          context: "Post-DQ getConsolidated eHex",
          requestId,
          isDq: true,
        }).catch(processAsyncError("Post-DQ eHex recreateConsolidated"));
      } catch (error) {
        if (isConditionalCheckFailedError(error)) {
          capture.message("Conversion completion already in progress or completed", {
            extra: {
              context: "handleEhexConversionStatus",
              patientId,
              cxId,
              requestId,
              error: errorToString(error),
            },
            level: "info",
          });
          return;
        }
        throw error;
      }
    }
  } catch (error) {
    const msg = `Failed to update conversion state for EHEX`;
    log(`${msg}: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        context: "handleEhexConversionStatus",
        patientId,
        cxId,
        requestId,
        docId,
        convertResult,
        error: errorToString(error),
      },
    });
    throw error;
  }
}

function shouldCompleteConversion({
  totalToConvert,
  totalConverted,
  totalErrors,
}: GetConversionParams): boolean {
  return totalToConvert > 0 && totalToConvert <= totalConverted + totalErrors;
}
