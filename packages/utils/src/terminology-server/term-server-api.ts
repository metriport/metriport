import axios from "axios";

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

interface CodeSystemUrl {
  name: string;
  url: string;
}

export const codeSystemUrls: Record<string, CodeSystemUrl> = {
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

export type CodeDetailsResponse = {
  parameter: {
    name: string;
    part: [
      {
        name: string;
        value?: string;
        valueCode?: string;
      }
    ];
  }[];
};

export async function getCodeDetailsFull(
  code: string,
  codeSystemType: string
): Promise<CodeDetailsResponse | undefined> {
  try {
    const codeSystem = codeSystemUrls[codeSystemType];
    if (!codeSystem) {
      console.error("Unsupported code system type:", codeSystemType);
      return undefined;
    }

    const url = `http://localhost:29927/R4/CodeSystem/$lookup?system=${codeSystem.url}&code=${code}`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.code === "ECONNREFUSED") {
      console.error("Connection refused. The server is not reachable at the moment.");
      return undefined;
    } else {
      // console.error(`Error fetching code details. Code Not Found ${code}`);
      return undefined;
    }
  }
}

export async function getCodeDisplay(
  code: string,
  codeSystemType: string
): Promise<{ display: string; category: string } | undefined> {
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
      // Extract the display text and category using a regular expression
      const match = displayParameter.valueString.match(/^(.+?)\s*\(([^)]+)\)$/);
      if (match) {
        return {
          display: match[1].trim(), // "Domestic abuse of adult"
          category: match[2].trim(), // "event"
        };
      } else {
        console.log("Display field format not recognized.");
        return undefined;
      }
    } else {
      console.log("Display field not found in the response.");
      return undefined;
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.code === "ECONNREFUSED") {
      console.error("Connection refused. The server is not reachable at the moment.");
      return undefined;
    } else {
      return undefined;
    }
  }
}
