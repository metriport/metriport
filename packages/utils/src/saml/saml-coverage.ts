import { readFileSync } from "fs";

/**
 * Script that analyzes the responses from a SAML request and outputs statistics on the number of
 * successful matches and errors for each vendor. It also allows for excluding specific vendors
 * from the analysis. Run this after running the bulk-saml script.
 */

interface Response {
  id: string;
  timestamp: string;
  responseTimestamp: string;
  patientMatch: boolean | null;
  operationOutcome: {
    issue: Array<{
      details: {
        text: string;
      };
    }>;
  };
  gateway: {
    url: string;
    oid: string;
    id: string;
  };
}

function analyzeResponses(filePath: string): void {
  const fileContent = readFileSync(filePath, "utf8");
  const data: Response[] = JSON.parse(fileContent);

  let patientMatchNullCount = 0;
  let patientMatchFalseCount = 0;
  const errorCounts: Record<string, number> = {};
  const nullGatewayUrls: Record<string, number> = {};
  const falseGatewayUrls: Record<string, number> = {};

  data.forEach(item => {
    const { patientMatch, operationOutcome, gateway } = item;
    if (patientMatch === null) {
      patientMatchNullCount++;
      if (
        operationOutcome.issue.length > 0 &&
        operationOutcome.issue[0].details &&
        operationOutcome.issue[0].details.text
      ) {
        const errorText = operationOutcome.issue[0].details.text;
        if (errorCounts[errorText]) {
          errorCounts[errorText]++;
        } else {
          errorCounts[errorText] = 1;
        }
      }
      if (nullGatewayUrls[gateway.url]) {
        nullGatewayUrls[gateway.url]++;
      } else {
        nullGatewayUrls[gateway.url] = 1;
      }
    } else if (patientMatch === false) {
      patientMatchFalseCount++;
      if (falseGatewayUrls[gateway.url]) {
        falseGatewayUrls[gateway.url]++;
      } else {
        falseGatewayUrls[gateway.url] = 1;
      }
    }
  });

  console.log(`Patient Match Null Count: ${patientMatchNullCount}`);
  console.log(`Patient Match False Count: ${patientMatchFalseCount}`);
  console.log("Error Counts:", errorCounts);
  console.log("Null Gateway URLs:", nullGatewayUrls);
  console.log("False Gateway URLs:", falseGatewayUrls);
}

function analyzeResponsesByVendor(filePath: string): void {
  const fileContent = readFileSync(filePath, "utf8");
  const data: Response[] = JSON.parse(fileContent);

  const stats: Record<
    string,
    //eslint-disable-next-line
    { success: number; total: number; errors: Record<string, { count: number; details: any[] }> }
  > = {
    Surescripts: { success: 0, total: 0, errors: {} },
    Epic: { success: 0, total: 0, errors: {} },
    ehealthexchange: { success: 0, total: 0, errors: {} },
    Athena: { success: 0, total: 0, errors: {} },
    Kno2: { success: 0, total: 0, errors: {} },
    Ntst: { success: 0, total: 0, errors: {} },
    Medent: { success: 0, total: 0, errors: {} },
    commonwellalliance: { success: 0, total: 0, errors: {} },
  };

  data.forEach(item => {
    const { patientMatch, operationOutcome, gateway } = item;
    const url = gateway.url.toLowerCase();

    // Increment total for each keyword found in the URL and track errors
    Object.keys(stats).forEach(key => {
      if (url.includes(key.toLowerCase())) {
        stats[key].total++;
        if (patientMatch !== null) {
          stats[key].success++;
        } else if (
          patientMatch === null &&
          operationOutcome.issue.length > 0 &&
          operationOutcome.issue[0].details &&
          "text" in operationOutcome.issue[0].details
        ) {
          const errorText = operationOutcome.issue[0].details.text;
          const errorDetail = {
            gatewayUrl: gateway.url,
            gatewayOid: gateway.oid,
            gatewayId: gateway.id,
            timestamp: item.timestamp,
            responseTimestamp: item.responseTimestamp,
            requestId: item.id,
          };
          if (stats[key].errors[errorText]) {
            stats[key].errors[errorText].count++;
            stats[key].errors[errorText].details.push(errorDetail);
          } else {
            stats[key].errors[errorText] = { count: 1, details: [errorDetail] };
          }
        } else {
          // still incremen and track errors if no error text is found
          const errorText = "No error text";
          const errorDetail = {
            gatewayUrl: gateway.url,
            gatewayOid: gateway.oid,
            gatewayId: gateway.id,
            timestamp: item.timestamp,
            responseTimestamp: item.responseTimestamp,
            requestId: item.id,
          };
          if (stats[key].errors[errorText]) {
            stats[key].errors[errorText].count++;
            stats[key].errors[errorText].details.push(errorDetail);
          } else {
            stats[key].errors[errorText] = { count: 1, details: [errorDetail] };
          }
        }
      }
    });
  });

  console.log("Statistics by Vendor:", JSON.stringify(stats, null, 2));
}

function analyzeResponsesWithExclusions(filePath: string, excludeList: string[]): void {
  const fileContent = readFileSync(filePath, "utf8");
  const data: Response[] = JSON.parse(fileContent);

  const stats: Record<
    string,
    //eslint-disable-next-line
    { success: number; total: number; errors: Record<string, { count: number; details: any[] }> }
  > = {
    CatchAll: { success: 0, total: 0, errors: {} }, // Added catch-all category
  };

  data.forEach(item => {
    const { patientMatch, operationOutcome, gateway } = item;
    const url = gateway.url.toLowerCase();

    // Check if the current gateway should be excluded
    if (excludeList.some(exclude => url.includes(exclude.toLowerCase()))) {
      return; // Skip this gateway if it matches any exclude string
    }

    let matched = false;

    // Increment total for each keyword found in the URL and track errors
    Object.keys(stats).forEach(key => {
      if (key !== "CatchAll" && url.includes(key.toLowerCase())) {
        matched = true;
        stats[key].total++;
        if (patientMatch !== null) {
          stats[key].success++;
        } else {
          recordError(stats, key, operationOutcome, item);
        }
      }
    });

    // If no specific vendor matched, use the catch-all
    if (!matched) {
      stats.CatchAll.total++;
      if (patientMatch !== null) {
        stats.CatchAll.success++;
      } else {
        recordError(stats, "CatchAll", operationOutcome, item);
      }
    }
  });

  console.log("Statistics by Vendor with Exclusions:", JSON.stringify(stats, null, 2));
}

//eslint-disable-next-line
function recordError(stats: any, key: string, operationOutcome: any, item: any) {
  if (
    operationOutcome.issue.length > 0 &&
    operationOutcome.issue[0].details &&
    "text" in operationOutcome.issue[0].details
  ) {
    const errorText = operationOutcome.issue[0].details.text;
    const errorDetail = {
      gatewayUrl: item.gateway.url,
      gatewayOid: item.gateway.oid,
      gatewayId: item.gateway.id,
      timestamp: item.timestamp,
      responseTimestamp: item.responseTimestamp,
      requestId: item.id,
    };
    if (stats[key].errors[errorText]) {
      stats[key].errors[errorText].count++;
      stats[key].errors[errorText].details.push(errorDetail);
    } else {
      stats[key].errors[errorText] = { count: 1, details: [errorDetail] };
    }
  } else {
    // still increment and track errors if no error text is found
    const errorText = "No error text";
    const errorDetail = {
      gatewayUrl: item.gateway.url,
      gatewayOid: item.gateway.oid,
      gatewayId: item.gateway.id,
      timestamp: item.timestamp,
      responseTimestamp: item.responseTimestamp,
      requestId: item.id,
    };
    if (stats[key].errors[errorText]) {
      stats[key].errors[errorText].count++;
      stats[key].errors[errorText].details.push(errorDetail);
    } else {
      stats[key].errors[errorText] = { count: 1, details: [errorDetail] };
    }
  }
}

// Usage
const filePath = "./runs/saml-coverage/xyz.json";
analyzeResponsesByVendor(filePath);
analyzeResponsesWithExclusions(filePath, [
  "surescripts",
  "ehealthexchange",
  "commonwellalliance",
  "epic",
  "athena",
  "kno2",
  "ntst",
  "medent",
]);
analyzeResponses(filePath);
