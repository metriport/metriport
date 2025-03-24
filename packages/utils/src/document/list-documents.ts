// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import * as fs from "fs";

// Load environment variables from .env file
import dotenv from "dotenv";
import { DocumentReferenceContent } from "@medplum/fhirtypes";
import { DocumentReference } from "../../../ihe-gateway-sdk/dist";
dotenv.config();

// Configuration
const API_KEY = process.env.API_KEY || "";
const BASE_URL = process.env.BASE_URL || "https://api.metriport.com/medical/v1/document";
const ISO_DATE = "YYYY-MM-DD";

// Patient UUIDs to process
const patientUuids: string[] = [];

const METRIPORT_CODE = "METRIPORT";

function isMetriportContent(content: DocumentReferenceContent): boolean {
  return !!content.extension?.some(ext => ext.valueCoding?.code === METRIPORT_CODE);
}

const getMetriportContent = (doc: DocumentReference): DocumentReferenceContent | undefined => {
  if (!doc || !doc.content) return undefined;

  const contents = doc.content.filter(isMetriportContent);
  // B64 Attachment Extension
  if (
    contents.length === 0 &&
    doc.extension?.some(ext => ext.url?.endsWith("doc-id-extension.json"))
  ) {
    return doc.content[0];
  }
  return contents[0];
};

const getOrganizationName = (doc: DocumentReference): string => {
  if (doc.contained) {
    const org = doc.contained.flatMap(c => (c.resourceType === "Organization" ? c : []))[0];
    if (org?.name) return org.name;

    return "-";
  }
  return "-";
};

// Type definitions for our data structures
interface PatientRecord {
  docId: string;
  patientId: string;
  mrn: string;
  firstName: string;
  lastName: string;
  organization: string;
  description: string;
}

// API response interfaces
interface ApiResponse {
  documents: Document[];
  patientId: string;
}

interface Document {
  resourceType: string;
  id: string;
  subject: {
    reference: string;
    type: string;
  };
  contained?: object[];
  description?: string;
}

// Step 1: Fetch data from API
async function fetchData(uuid: string): Promise<ApiResponse> {
  console.log(`Fetching data for UUID: ${uuid}`);

  const options = {
    method: "GET",
    headers: {
      "x-api-key": API_KEY,
      "Content-Type": "application/json",
    },
  };

  try {
    // API endpoint with the patient UUID
    const url = `${BASE_URL}?patientId=${uuid}`;

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    console.log(`Retrieved ${data.documents?.length || 0} documents for patient ${uuid}`);

    return data;
  } catch (error) {
    console.error(`Error fetching data for UUID ${uuid}:`, error);
    // Return an empty response structure instead of throwing
    return { patientId: uuid, documents: [] };
  }
}

function formatDate(date) {
  // Create an array of month names
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  // Get the date components
  const month = monthNames[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  // Construct the formatted date string
  return `${month} ${day}, ${year}`;
}

// Step 2: Parse the API response
function parseData(response: ApiResponse): Omit<PatientRecord, "patientId">[] {
  console.log("Parsing response data");

  const records: Omit<PatientRecord, "patientId">[] = [];

  // Process each document in the response
  for (const doc of response.documents || []) {
    try {
      const metriportContent = getMetriportContent(doc);
      const contentType = metriportContent?.attachment?.contentType;
      const description = doc.description || "No description available";

      // Create record with all fields
      const record: Omit<PatientRecord, "patientId"> = {
        date: doc.date ? formatDate(new Date(doc.date), ISO_DATE) : "-",
        organization: getOrganizationName(doc),
        description,
        firstName: "",
        lastName: "",
        contentType,
        docId: doc.id,
      };

      records.push(record);
    } catch (error) {
      console.error("Error parsing document:", error);
      // Continue to the next document if there's an error
    }
  }

  return records;
}

function formatToCsv(records: PatientRecord[]): string {
  console.log(`Formatting ${records.length} records to CSV`);

  if (records.length === 0) {
    return ""; // Return empty string if no records
  }

  try {
    // Get all keys from the first record to use as CSV headers
    const firstRecord = records[0];
    const headers = Object.keys(firstRecord);

    // Create CSV header row
    const headerRow = headers.join(",");

    // Create data rows
    const dataRows = records.map((record, index) => {
      // Verify that this record has all expected fields
      const recordKeys = Object.keys(record);
      const missingKeys = headers.filter(key => !recordKeys.includes(key));

      if (missingKeys.length > 0) {
        throw new Error(
          `Record at index ${index} is missing required fields: ${missingKeys.join(", ")}`
        );
      }

      // Map each header to its value, wrapping in quotes and escaping quotes within values
      return headers
        .map(header => {
          const value = record[header as keyof PatientRecord];
          // Convert to string, handle null/undefined as empty string
          const stringVal = value === null || value === undefined ? "" : String(value);
          // Escape quotes and wrap in quotes if the value contains commas, quotes, or newlines
          if (stringVal.includes(",") || stringVal.includes('"') || stringVal.includes("\n")) {
            return `"${stringVal.replace(/"/g, '""')}"`;
          }
          return stringVal;
        })
        .join(",");
    });

    // Combine header and data rows
    return [headerRow, ...dataRows].join("\n");
  } catch (error) {
    console.error("Error formatting CSV:", error);
    throw error; // Re-throw to let the caller handle it
  }
}

interface PatientApiResponse {
  firstName: string;
  lastName: string;
  externalId: string;
}

// New function to fetch patient data
async function fetchPatientData(uuid: string): Promise<PatientApiResponse | null> {
  console.log(`Fetching patient data for UUID: ${uuid}`);

  const options = {
    method: "GET",
    headers: {
      "x-api-key": API_KEY,
      "Content-Type": "application/json",
    },
  };

  try {
    const url = `${BASE_URL.replace("/document", "/patient")}/${uuid}`;
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`Patient API request failed with status: ${response.status}`);
    }

    const data: PatientApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching patient data for UUID ${uuid}:`, error);
    return null;
  }
}

// Main execution function
async function main(): Promise<void> {
  try {
    console.log("Starting data collection process");

    // Check if API key is provided
    if (!API_KEY) {
      throw new Error("API_KEY is required. Please set it in your .env file.");
    }

    // Collection of patient records
    const patientRecords: PatientRecord[] = [];

    // Process each UUID
    for (const uuid of patientUuids) {
      // Step 1: Fetch data
      const [response, patientResponse] = await Promise.all([
        fetchData(uuid),
        fetchPatientData(uuid),
      ]);

      // Step 2: Parse data
      const parsedData = parseData(response);

      if (parsedData) {
        parsedData.forEach(record => {
          patientRecords.push({
            ...record,
            patientId: uuid,
            mrn: patientResponse?.externalId || "",
            firstName: patientResponse?.firstName || "",
            lastName: patientResponse?.lastName || "",
          });
        });
      }

      console.log(`Sleeping for 2 seconds`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Step 3: Format to CSV
    const csvData = formatToCsv(patientRecords);

    // Write to file
    fs.writeFileSync("patient_records.csv", csvData);

    console.log("Data collection complete. Results saved to patient_records.csv");
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

// Execute the main function
main();
