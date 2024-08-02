import { Resource } from "@medplum/fhirtypes";
import { medical } from "@metriport/shared";
import { SearchSetBundle } from "@metriport/shared/medical";
import { Patient } from "@metriport/core/domain/patient";
import { getConsolidatedFhirBundle } from "@metriport/core/external/fhir/consolidated";
import { out } from "@metriport/core/util/log";
import * as Sentry from "@sentry/serverless";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";

// Keep this as early on the file as possible
capture.init();

const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");

export const handler = Sentry.AWSLambda.wrapHandler(
  async ({
    patient,
    documentIds,
    resources,
    dateFrom,
    dateTo,
  }: {
    patient: Pick<Patient, "id" | "cxId">;
    documentIds?: string[];
    resources?: medical.ResourceTypeForConsolidation[];
    dateFrom?: string;
    dateTo?: string;
  }): Promise<SearchSetBundle<Resource>> => {
    const { log } = out(`cx ${patient.cxId}`);
    log(
      `Running with dateFrom: ${dateFrom}, dateTo: ${dateTo}, ` +
        `documentIds: ${documentIds}, resources: ${resources}}`
    );
    try {
      return await getConsolidatedFhirBundle({
        patient,
        documentIds,
        resources,
        dateFrom,
        dateTo,
      });
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
