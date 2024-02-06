import axios from "axios";

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

// Modified function to accept codeSystemType
export async function getCodeDetails(code: string, codeSystemType: string) {
  try {
    // Retrieve the code system URL based on the codeSystemType
    const codeSystem = codeSystemUrls[codeSystemType];
    if (!codeSystem) {
      console.error("Unsupported code system type:", codeSystemType);
      return;
    }

    // Use the URL from the code system
    const url = `http://localhost:29927/R4/CodeSystem/$lookup?system=${codeSystem.url}&code=${code}`;
    const response = await axios.get(url);
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error("Error fetching code details:", error);
  }
}

// Example usage with a specific code and code system type
//convertCodeSystem('2.16.840.1.113883.6.90');
//getCodeDetails('1963-8', 'LNC');
