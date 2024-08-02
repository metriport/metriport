import { Resource } from "@medplum/fhirtypes";
import { medical } from "@metriport/shared";
import { SearchSetBundle } from "@metriport/shared/medical";
import { Patient } from "@metriport/core/domain/patient";
import { getConsolidatedFhirBundle } from "@metriport/core/external/fhir/consolidated";
import { out } from "@metriport/core/util/log";
import * as Sentry from "@sentry/serverless";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { apiClient } from "./shared/oss-api";

// Keep this as early on the file as possible
capture.init();

const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
const apiURL = getEnvOrFail("API_URL");

const ossApi = apiClient(apiURL);

export const handler = Sentry.AWSLambda.wrapHandler(
  async ({
    patient,
    requestId,
    conversionType,
    documentIds,
    resources,
    dateFrom,
    dateTo,
    isAsync,
  }: {
    patient: Pick<Patient, "id" | "cxId">;
    requestId?: string;
    conversionType?: medical.ConsolidationConversionType;
    documentIds?: string[];
    resources?: medical.ResourceTypeForConsolidation[];
    dateFrom?: string;
    dateTo?: string;
    isAsync?: boolean;
  }): Promise<SearchSetBundle<Resource> | void> => {
    const { log } = out(`cx ${patient.cxId}`);
    log(
      `Running with dateFrom: ${dateFrom}, dateTo: ${dateTo}, ` +
        `documentIds: ${documentIds}, resources: ${resources}}`
    );
    try {
      const bundle = await getConsolidatedFhirBundle({
        patient,
        documentIds,
        resources,
        dateFrom,
        dateTo,
      });
      if (isAsync) {
        ossApi.postConsolidated({
          patientId: patient.id,
          bundle,
          requestId,
          conversionType,
          resources,
          dateFrom,
          dateTo,
        });
      } else {
        return bundle;
      }
    } catch (error) {
      const msg = "Failed to get FHIR resources";
      const filters = {
        documentIds,
        resources,
        dateFrom,
        dateTo,
      };
      log(`${msg}: ${JSON.stringify(filters)}`);
      capture.error(msg, {
        extra: {
          error,
          context: lambdaName,
          patientId: patient.id,
          ...filters,
        },
      });
      throw error;
    }
  }
);
