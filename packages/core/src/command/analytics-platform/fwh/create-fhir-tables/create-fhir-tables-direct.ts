import { DbCreds, sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Config } from "../../../../util/config";
import { SingleUserAndPasswordAndSchemas } from "../setup-cx-fwh";
import { getCxFwhName, rawDbSchema, TableDefinitions } from "../utils";
import { CreateFhirTablesHandler, CreateFhirTablesRequest } from "./create-fhir-tables";
import { setupFdwForCustomerFwh } from "./setup-fdw";
import { createFhirTablesForCustomerFwh } from "./setup-fhir-tables";

dayjs.extend(duration);

const replicationWait = dayjs.duration(5, "seconds");

/**
 * Creates FHIR (raw) tables directly in the customer FWH (no Lambda).
 * Uses local config path for table definitions. For use in dev.
 */
export class CreateFhirTablesDirect implements CreateFhirTablesHandler {
  constructor(
    private readonly tablesDefinitions: TableDefinitions,
    private readonly dbCreds: DbCreds,
    private readonly dbUsersToGrantAccess: Omit<
      SingleUserAndPasswordAndSchemas,
      "schemaNames"
    >[] = [],
    private readonly useMonthlyDeletedPartitions: boolean = true
  ) {}

  async createFhirTables(request: CreateFhirTablesRequest): Promise<void> {
    const { cxId } = request;

    await createFhirTablesForCustomerFwh({
      cxId,
      dbCreds: this.dbCreds,
      schemaName: rawDbSchema,
      tablesDefinitions: this.tablesDefinitions,
      grantAccessUsernames: this.dbUsersToGrantAccess.map(user => user.username),
      useMonthlyDeletedPartitions: this.useMonthlyDeletedPartitions,
    });
    await sleep(replicationWait.asMilliseconds());
    await setupFdwForCustomerFwh({
      cxId,
      dbCreds: this.dbCreds,
      readerHost: Config.getAnalyticsDbReaderHost(),
      readerCname: Config.getAnalyticsDbReaderCname(),
      readerPort: this.dbCreds.port,
      dbName: getCxFwhName({ cxId, dbname: this.dbCreds.dbname }),
      schemaName: rawDbSchema,
      dbUsersToGrantAccess: this.dbUsersToGrantAccess,
    });
  }
}
