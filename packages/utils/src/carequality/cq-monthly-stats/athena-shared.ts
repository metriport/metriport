import {
  AthenaClient,
  StartQueryExecutionCommand,
  StartQueryExecutionCommandInput,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  GetQueryResultsCommandInput,
  Row,
  ColumnInfo,
} from "@aws-sdk/client-athena";
import { sleep } from "@metriport/shared";
import { buildDayjs, ISO_DATE } from "@metriport/shared/common/date";

const client = new AthenaClient({ region: "us-west-1" });

export type TableResults = {
  requesttimestamp: string;
  patientmatch?: boolean;
  responsetimestamp: string;
  gateway: string;
  duration: number;
};

export async function queryResultsTableAthena(
  endOfPreviousMonth: string,
  dayIndex: number
): Promise<TableResults[]> {
  const updateDay = buildDayjs(endOfPreviousMonth).subtract(dayIndex, "day").format(ISO_DATE);

  const queryExecutionId = await createQueryExecutionId(updateDay);

  let isQueryRunning = true;

  while (isQueryRunning) {
    isQueryRunning = await checkQueryCreateStatus(queryExecutionId);
    await sleep(10000);
  }

  const queryResults = await getQueryResultByExecutionId(queryExecutionId);

  if (queryResults) {
    const tableResults = buildTable(queryResults);
    const tableResultsWithDurations = addDurationsToTable(tableResults);

    console.log("tableResults:", tableResults.length);
    console.log("tableResultsWithDurations:", tableResultsWithDurations.length);

    return tableResultsWithDurations;
  }

  return [];
}

async function createQueryExecutionId(date: string): Promise<string> {
  /** doing resultConfiguration, but we will not save query result there. */
  const params: StartQueryExecutionCommandInput = {
    QueryString: `
      SELECT responsetimestamp, requesttimestamp, gateway, patientmatch FROM "default"."ihe_parsed_responses_by_date" a
      WHERE a.date = '${date}'` /* required */,
    ResultConfiguration: {
      /* required */ OutputLocation: `s3://aws-athena-query-results-463519787594-us-west-1`,
      /* required s3 output location path*/
      EncryptionConfiguration: {
        EncryptionOption: "SSE_S3" /* required */,
      },
    },
  };

  const data = await client.send(new StartQueryExecutionCommand(params));

  return data.QueryExecutionId ?? "";
}

async function checkQueryCreateStatus(queryExecutionId: string): Promise<boolean> {
  const params = {
    QueryExecutionId: queryExecutionId,
  };

  try {
    const output = await client.send(new GetQueryExecutionCommand(params));

    if (
      output &&
      output.QueryExecution &&
      output.QueryExecution.Status &&
      output.QueryExecution.Status.State &&
      output.QueryExecution.Status.State !== "SUCCEEDED"
    ) {
      console.log("Athena Query status is running");
      return true;
    }

    console.log("Athena Query status is Succeeded");

    return false;
  } catch (error) {
    return false;
  }
}

async function getQueryResultByExecutionId(queryExecutionId: string): Promise<{
  rows: Row[];
  columns: ColumnInfo[];
}> {
  const params = {
    QueryExecutionId: queryExecutionId,
  };

  let columns: ColumnInfo[] = [];
  let resultsRows: Row[] = [];

  const resp = await client.send(new GetQueryResultsCommand(params));

  console.log("resp first:", resp.NextToken);
  console.log("resp first length:", resp.ResultSet?.Rows?.length);

  if (resp.NextToken) {
    let nextToken: string | undefined = resp.NextToken;
    resultsRows = resultsRows.concat(resp.ResultSet?.Rows ?? []);

    while (nextToken) {
      const nextParams: GetQueryResultsCommandInput = {
        QueryExecutionId: queryExecutionId,
        NextToken: nextToken,
      };

      const nextResp = await client.send(new GetQueryResultsCommand(nextParams));

      console.log("resp second:", nextResp.NextToken);
      console.log("resp second length:", nextResp.ResultSet?.Rows?.length);

      resultsRows = resultsRows.concat(nextResp.ResultSet?.Rows ?? []);

      nextToken = nextResp.NextToken;

      sleep(5000);
    }
  } else {
    resultsRows = resp.ResultSet?.Rows ?? [];
  }

  if (resp.ResultSet?.ResultSetMetadata?.ColumnInfo) {
    columns = resp.ResultSet?.ResultSetMetadata?.ColumnInfo;
  }

  return {
    rows: resultsRows,
    columns: columns,
  };
}

function buildTable(output: {
  rows: Row[];
  columns: ColumnInfo[];
}): Array<{ [key: string]: string }> {
  const columns = output.columns.map(column => column.Name) ?? [];

  const rows = output.rows.map(row => {
    return row.Data?.map(data => {
      return data.VarCharValue;
    });
  });

  rows?.shift();

  const colToRow = rows?.map(row => {
    return columns.reduce((acc, curr, index) => {
      if (curr && row) {
        return { ...acc, [curr]: row[index] };
      }

      return acc;
    }, {});
  });

  if (!colToRow) {
    return [];
  }

  return colToRow;
}

function addDurationsToTable(tableResults: Array<{ [key: string]: string }>): TableResults[] {
  return tableResults.map(result => {
    const requesttimestamp = buildDayjs(result.requesttimestamp);
    const responsetimestamp = buildDayjs(result.responsetimestamp);

    return {
      ...result,
      duration: responsetimestamp.diff(requesttimestamp, "milliseconds"),
    };
  }) as TableResults[];
}
