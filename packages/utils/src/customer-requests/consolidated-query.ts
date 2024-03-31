import fs from "fs/promises";
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";

const apiKey = getEnvVarOrFail("API_KEY");
const metriportApi: MetriportMedicalApi = new MetriportMedicalApi(apiKey);

const patientIds: string[] = [""];
const resultsDirectory = "./consolidatedPatients";

const ensureDirectory = async (): Promise<void> => {
  await fs.mkdir(resultsDirectory, { recursive: true });
};

const fetchAndSavePatientData = async (patientId: string): Promise<void> => {
  try {
    const data = await metriportApi.getPatientConsolidated(patientId);
    const filePath = `${resultsDirectory}/${patientId}.json`;
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`Data saved for patient ${patientId}`);
  } catch (error) {
    console.error(`Error fetching data for patient ${patientId}:`, error);
  }
};

const processPatients = async (): Promise<void> => {
  await ensureDirectory();
  for (const patientId of patientIds) {
    await fetchAndSavePatientData(patientId);
  }
  console.log("All patient data processed.");
};

processPatients();
