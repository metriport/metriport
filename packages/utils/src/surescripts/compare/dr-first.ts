import { Command } from "commander";
import fs from "fs";
import path from "path";

import { getConsolidatedBundle } from "../shared";

// import { dangerouslyDeduplicateFhir } from "@metriport/core/fhir-deduplication/deduplicate-fhir";

const DR_FIRST_DIR = path.join(process.cwd(), "runs", "drfirst");
const CX_ID = process.env.TARGET_COMPARISON_CX_ID ?? "";

const program = new Command();

program.name("dr-first").description("Run the comparison of Dr First to Metriport").action(main);

async function main() {
  console.log("Running comparison of Dr First to Metriport");
  if (!CX_ID) throw new Error("TARGET_COMPARISON_CX_ID is not set");

  const patientIdMap = getPatientIdMapping();
  console.log(patientIdMap);
  const nameIds = getDrFirstOutputNameIds();
  console.log(nameIds);

  for (const nameId of nameIds) {
    const drFirstOutput = getDrFirstOutput(nameId);
    const drFirstStatistics = computeDrFirstStatistics(drFirstOutput);
    console.log(nameId, drFirstStatistics);

    const patientId = patientIdMap[nameId];
    if (!patientId) throw new Error(`Patient ID not found for ${nameId}`);

    const consolidatedBundle = await getConsolidatedBundle(CX_ID, patientId);
    console.log("found HIE bundle", consolidatedBundle != null);

    // const conversionBundle = await getConversionBundle(CX_ID, patientId);
    // console.log(conversionBundle);
  }
}

function computeDrFirstStatistics(drFirstOutput: DrFirstOutput) {
  let totalFills = 0;
  drFirstOutput.medications.forEach(medication => {
    totalFills += medication.timeline.oneYear.filled.length;
  });

  const statistics = {
    medications: drFirstOutput.medications.length,
    fills: totalFills,
  };
  return statistics;
}

function getPatientIdMapping(): Record<string, string> {
  const mapping = JSON.parse(fs.readFileSync(path.join(DR_FIRST_DIR, "mapping.json"), "utf8"));
  return mapping;
}

function getDrFirstOutputNameIds() {
  const nameIds = fs.readdirSync(path.join(DR_FIRST_DIR, "data"));
  return nameIds
    .filter(nameId => nameId.endsWith(".json"))
    .map(nameId => nameId.replace(".json", ""));
}

function getDrFirstOutput(nameId: string): DrFirstOutput {
  const drFirstOutput = JSON.parse(
    fs.readFileSync(path.join(DR_FIRST_DIR, "data", nameId + ".json"), "utf8")
  );
  return drFirstOutput;
}

export default program;

interface DrFirstOutput {
  patientDemographics: {
    firstName: string;
    lastName: string;
    gender: string;
    dateOfBirth: string;
    addressList: Array<{
      zipcode: string;
      country: string;
    }>;
  };
  medications: Array<{
    isDrugScheduled: string;
    isCompound: string;
    isUnspecified: string;
    isGeneric: string;
    ndcId: string;
    genericName: string;

    timeline: {
      oneYear: {
        filled: Array<{
          dataSources: string;
          startDate: string;
          endDate: string;
          daysCount: string;
          drugName: string;
          sig: string;
          providerName: string;
          pharmacyName: string;
          pharmacyPhone: string;
          refillsRemaining: string;
        }>;
      };
    };
    fills: Array<{
      sources: Array<{
        type: string;
        fillRecord: {
          responsePbmName: string;
          drugId: string;
          drugName: string;
          drugIdQualifier: string;
          drugGenericName: string;
          drugStrength: string;
          sourceDrugDescription: string;
          quantity: string;
          quantityQualifier: string;
          potencyUnitCode: string;
          potencyUnitValue: string;
          sig: string;
          form: string;
          formSourceCode: string;
          dateWritten: string;
          soldDate: string;
          fillDate: string;
          daysSupply: string;
          productSubstitutionCode: string;
          refillsRemaining: string;
          fillNumber: string;
          doseUnit: string;
          drugDuration: string;
          diagnosisClinicalQualifier1: string;
          primaryDiagnosisInformation1: string;
          primaryDiagnosisQualifier1: string;
          primaryDiagnosisDescription1: string;
          prescriptionNumber: string;
          prescriber: {
            firstname: string;
            lastname: string;
            middlename: string;
            address: {
              address1: string;
              city: string;
              state: string;
              zipcode: string;
            };
            npi: string;
            dea: string;
            phoneList: Array<{
              qualifier: string;
              number: string;
            }>;
          };
          participantId: string;
          participantIdIdentifier: string;
          participantName: string;
          pharmacy: {
            npi: string;
            ncpdpId: string;
            name: string;
            address: {
              address1: string;
              city: string;
              state: string;
              zipcode: string;
            };
            phone: Array<{
              qualifier: string;
              number: string;
            }>;
          };
          drugDeaSchedule: string;
          priorAuthorized: string;
          payerSource: string;
          dataSource: string;
          sourceDescription: string;
          isUnspecified: string;
          isGeneric: string;
        };
      }>;
      responsePbmName: string;
      drugId: string;
      drugName: string;
      drugIdQualifier: string;
      drugGenericName: string;
      drugStrength: string;
      sourceDrugDescription: string;
      quantity: string;
      quantityQualifier: string;
      potencyUnitCode: string;
      potencyUnitValue: string;
      sig: string;
      form: string;
      formSourceCode: string;
      dateWritten: string;
      soldDate: string;
      fillDate: string;
      daysSupply: string;
      productSubstitutionCode: string;
      refillsRemaining: string;
      fillNumber: string;
      doseUnit: string;
      drugDuration: string;
      diagnosisClinicalQualifier1: string;
      primaryDiagnosisInformation1: string;
      primaryDiagnosisQualifier1: string;
      primaryDiagnosisDescription1: string;
      prescriptionNumber: string;
      prescriber: {
        firstname: string;
        lastname: string;
        middlename: string;
        address: {
          address1: string;
          city: string;
          state: string;
          zipcode: string;
        };
        npi: string;
        dea: string;
        phoneList: Array<{
          qualifier: string;
          number: string;
        }>;
      };
      participantId: string;
      participantIdIdentifier: string;
      participantName: string;
      pharmacy: {
        npi: string;
        ncpdpId: string;
        name: string;
        address: {
          address1: string;
          city: string;
          state: string;
          zipcode: string;
        };
        phone: Array<{
          qualifier: string;
          number: string;
        }>;
      };
      drugDeaSchedule: string;
      priorAuthorized: string;
      payerSource: string;
      dataSource: string;
      sourceDescription: string;
      isUnspecified: string;
      isGeneric: string;
    }>;
  }>;
}
