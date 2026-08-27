import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { parseConfigsIntoColumnsByTableName } from "@metriport/core/command/analytics-platform/fhir-to-csv/configs/read-column-defs";
import { CreateFhirTablesDirect } from "@metriport/core/command/analytics-platform/fwh/create-fhir-tables/create-fhir-tables-direct";
import { rawDbSchema } from "@metriport/core/command/analytics-platform/fwh/utils";
import { dbCredsSchema, getEnvVarOrFail, MetriportError } from "@metriport/shared";
import { z } from "zod";
import { capture } from "../shared/capture";
import { prefixedLog } from "../shared/log";

capture.init();

const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");
const dbCredsSecretArn = getEnvVarOrFail("DB_CREDS_SECRET_ARN");
const rawToCoreUsername = getEnvVarOrFail("RAW_TO_CORE_DB_USERNAME");
const fhirToCsvUsername = getEnvVarOrFail("FHIR_TO_CSV_DB_USERNAME");
const rawToCorePasswordSecretArn = getEnvVarOrFail("RAW_TO_CORE_DB_PASSWORD_SECRET_ARN");
const fhirToCsvPasswordSecretArn = getEnvVarOrFail("FHIR_TO_CSV_DB_PASSWORD_SECRET_ARN");

const createFhirTablesSchema = z.object({ cxId: z.string().min(1) });

export const handler = capture.wrapHandler(
  async (event: unknown): Promise<{ statusCode: number; body: string }> => {
    capture.setExtra({ event, context: lambdaName });
    const parsedBody = createFhirTablesSchema.parse(event);
    const { cxId } = parsedBody;

    const dbCredsSecret = await (getSecret(dbCredsSecretArn) as Promise<string | undefined>);
    if (!dbCredsSecret) {
      throw new MetriportError(`DB password not found`, undefined, {
        secretArn: dbCredsSecretArn,
      });
    }
    const dbCreds = dbCredsSchema.parse(JSON.parse(dbCredsSecret));
    const rawToCorePassword = await (getSecret(rawToCorePasswordSecretArn) as Promise<
      string | undefined
    >);
    if (!rawToCorePassword) {
      throw new MetriportError(`Raw to core password not found`, undefined, {
        secretArn: rawToCorePasswordSecretArn,
      });
    }
    const fhirToCsvPassword = await (getSecret(fhirToCsvPasswordSecretArn) as Promise<
      string | undefined
    >);
    if (!fhirToCsvPassword) {
      throw new MetriportError(`Fhir to csv password not found`, undefined, {
        secretArn: fhirToCsvPasswordSecretArn,
      });
    }

    const log = prefixedLog(`cxId ${cxId}`);

    log(`Reading table definitions from /opt/configurations`);
    const tablesDefinitions = parseConfigsIntoColumnsByTableName(`/opt/configurations`);

    const createFhirTablesHandler = new CreateFhirTablesDirect(
      tablesDefinitions,
      {
        ...dbCreds,
        schemaName: rawDbSchema,
      },
      [
        { username: fhirToCsvUsername, password: fhirToCsvPassword },
        { username: rawToCoreUsername, password: rawToCorePassword },
      ],
      true
    );

    await createFhirTablesHandler.createFhirTables({ cxId });

    log(`Create FHIR tables completed for cx ${cxId}`);
    return { statusCode: 200, body: JSON.stringify({ cxId }) };
  }
);
