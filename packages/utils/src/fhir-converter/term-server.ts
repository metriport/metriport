import axios from "axios";
const codesWithFrequency = [
  ["33999-4", 20991],
  ["85847-2", 19001],
  ["48767-8", 15154],
  ["55561003", 12575],
  ["116154003", 11816],
  ["29308-4", 10550],
  ["246514001", 9762],
  ["29762-2", 9424],
  ["76662-6", 9323],
  ["72166-2", 9298],
  ["46240-8", 9210],
  ["18776-5", 9189],
  ["76689-9", 9115],
  ["51848-0", 8902],
  ["11506-3", 8820],
  ["263486008", 8572],
  ["8689-2", 8350],
  ["311401005", 8005],
  ["17636008", 7442],
  ["11367-0", 7122],
  ["76691-5", 6473],
  ["76690-7", 6473],
  ["ASSERTION", 6293],
  ["73425007", 6013],
  ["0", 5770],
  ["16", 5674],
  ["451381000124107", 5600],
  ["282291009", 5376],
  ["SPRECEIVE", 5071],
  ["75310-3", 4888],
  ["8661-1", 4746],
  ["29299-5", 4663],
  ["266919005", 4543],
  ["CONC", 4398],
  ["30954-2", 3303],
  ["X-SDOH-19222", 3186],
  ["8716-3", 3040],
  ["416118004", 2945],
  ["47519-4", 2871],
  ["34109-9", 2677],
  ["10164-2", 2598],
  ["NAR", 2582],
  ["65568007", 2378],
  ["8517006", 2274],
  ["77176002", 2248],
  ["1", 1897],
  ["208D00000X", 1837],
  ["840546002", 1718],
  ["IMMUNIZ", 1695],
  ["266927001", 1515],
  ["8663-7", 1481],
  ["412307009", 1351],
  ["48768-6", 1244],
  ["64572001", 1178],
  ["75323-6", 1178],
  ["401201003", 1132],
  ["44261-6", 1041],
  ["282N00000X", 1041],
  ["7", 1019],
  ["449868002", 984],
  ["76513-1", 967],
  ["X-SDOH-19929", 967],
  ["X-SDOH-19944", 967],
  ["X-SDOH-19945", 967],
  ["X-SDOH-19946", 967],
  ["X-SDOH-19947", 967],
  ["47420-5", 956],
  ["PXN", 939],
  ["42349-1", 904],
  ["48765-2", 891],
  ["409073007", 874],
  ["305058001", 870],
  ["68518-0", 843],
  ["X-SDOH-19934", 843],
  ["68519-8", 843],
  ["X-SDOH-19935", 843],
  ["68520-6", 843],
  ["X-SDOH-19936", 843],
  ["61146-7", 837],
  ["69730-0", 835],
  ["55607006", 814],
  ["26436-6", 718],
  ["11450-4", 707],
  ["11369-6", 707],
  ["10160-0", 702],
  ["34133-9", 685],
  ["X-SDOH-19214", 685],
  ["GUAR", 613],
  ["67723-7", 596],
  ["29549-3", 590],
  ["8653-8", 582],
  ["IMP", 563],
  ["10183-2", 536],
  ["X-DOCCMT", 459],
  ["SEV", 428],
  ["73830-2", 406],
  ["74018-3", 404],
  ["64991-3", 404],
  ["74711-3", 367],
  ["C101722", 367],
];
export const codeSystemMapping: Record<string, string> = {
  "2.16.840.1.113883.6.1": "LNC", // LOINC
  "2.16.840.1.113883.6.96": "SNOMEDCT_US", // SNOMED CT
  "2.16.840.1.113883.6.12": "CPT", // CPT-4
  "2.16.840.1.113883.6.90": "ICD10CM", // ICD10
  "2.16.840.1.113883.6.88": "RXNORM", // RxNorm
  "2.16.840.1.113883.12.292": "CVX", // CVX
  "2.16.840.1.113883.6.103": "ICD9", // ICD9
  "2.16.840.1.113883.6.69": "NDC", // NDC
};

// Define the structure for code system URLs
interface CodeSystemUrl {
  name: string;
  url: string;
}

// Define the code system URLs
const codeSystemUrls: Record<string, CodeSystemUrl> = {
  SNOMEDCT_US: {
    name: "SNOMED CT US",
    url: "http://snomed.info/sct",
  },
  ICD10PCS: {
    name: "ICD-10-PCS",
    url: "http://hl7.org/fhir/sid/icd-10-pcs",
  },
  ICD10CM: {
    name: "ICD-10-CM",
    url: "http://hl7.org/fhir/sid/icd-10-cm",
  },
  LNC: {
    name: "LOINC",
    url: "http://loinc.org",
  },
  CPT: {
    name: "CPT",
    url: "http://www.ama-assn.org/go/cpt",
  },
  RXNORM: {
    name: "RxNorm",
    url: "http://www.nlm.nih.gov/research/umls/rxnorm",
  },
  CVX: {
    name: "CVX",
    url: "http://hl7.org/fhir/sid/cvx",
  },
};

export async function convertCodeSystem(oid: string) {
  try {
    // Use the OID to find the key in codeSystemMapping
    const key = codeSystemMapping[oid];
    if (!key) {
      console.error("Unsupported code system OID:", oid);
      return;
    }

    // Retrieve the corresponding URL and name from codeSystemUrls using the key
    const { url, name } = codeSystemUrls[key];
    console.log(`Converted: ${name} with URL ${url}`);
    return { name, url };
  } catch (error) {
    console.error("Error converting code system:", error);
  }
}

interface ParameterPart {
  name: string;
  valueCode?: string;
  valueString?: string;
}

interface Parameter {
  name: string;
  valueString?: string;
  part?: ParameterPart[];
}

interface CodeDetail {
  frequency: string | number;
  details: string | undefined;
  codeSystemType: "LNC" | "SNOMEDCT_US";
}

export async function getCodeDetails(
  code: string,
  codeSystemType: string
): Promise<string | undefined> {
  try {
    const codeSystem = codeSystemUrls[codeSystemType];
    if (!codeSystem) {
      console.error("Unsupported code system type:", codeSystemType);
      return undefined;
    }

    const url = `http://localhost:29927/R4/CodeSystem/$lookup?system=${codeSystem.url}&code=${code}`;
    const response = await axios.get(url);

    const displayParameter = response.data.parameter.find((p: Parameter) => p.name === "display");
    if (displayParameter && displayParameter.valueString) {
      return displayParameter.valueString; // Logs the 'display' field's value
    } else {
      console.log("Display field not found in the response.");
      return undefined;
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.code === "ECONNREFUSED") {
      console.error("Connection refused. The server is not reachable at the moment.");
      return undefined;
    } else {
      console.error("Error fetching code details. Code Not Found");
      return undefined;
    }
  }
}

export async function main() {
  // Example usage with a specific code and code system type
  const results: Record<string, CodeDetail> = {};

  for (const [code, frequency] of codesWithFrequency) {
    const codeStr = String(code);
    const codeSystemType = codeStr.includes("-") ? "LNC" : "SNOMEDCT_US";
    try {
      const details = await getCodeDetails(codeStr, codeSystemType);
      if (details) {
        results[codeStr] = { frequency, details, codeSystemType };
      }
    } catch (error) {
      console.error(`Failed to fetch details for code ${codeStr}:`, error);
    }
  }

  const totalCodes = {
    SNOMEDCT_US: 112859,
    LNC: 224898,
  };

  function processAndPrintResultsForCodeSystem(
    entries: [string, CodeDetail][],
    codeSystemType: "LNC" | "SNOMEDCT_US"
  ) {
    let totalFrequency = 0; // Initialize total frequency for the code system

    const filteredAndSortedResults = entries
      .filter(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ([_, { details, codeSystemType: entryCodeSystemType }]) =>
          details !== undefined && entryCodeSystemType === codeSystemType
      ) // Filter by codeSystemType and undefined details
      .sort((a, b) => {
        const freqA = +a[1].frequency;
        const freqB = +b[1].frequency;
        return freqB - freqA; // Sort by frequency in descending order
      })
      .map(([code, { frequency, details }]) => {
        totalFrequency += +frequency; // Add frequency to totalFrequency
        const total = totalCodes[codeSystemType];
        const percentage = ((+frequency / total) * 100).toFixed(2); // Convert to percentage
        return {
          code,
          frequency: +frequency,
          details,
          codeSystemType,
          percentage: `${percentage}%`,
        };
      });

    // Print the total frequency for the code system
    console.log(`Total frequency for ${codeSystemType}: ${totalFrequency}`);

    // Print the results for the specific code system type
    console.log(`Results for ${codeSystemType}:`);
    console.log(filteredAndSortedResults);
  }

  // Print the sorted results with percentage
  processAndPrintResultsForCodeSystem(Object.entries(results), "SNOMEDCT_US");
  processAndPrintResultsForCodeSystem(Object.entries(results), "LNC");
}

main();
