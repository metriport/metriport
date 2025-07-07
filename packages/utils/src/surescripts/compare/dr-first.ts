import { Command } from "commander";
import fs from "fs";
import path from "path";
import { buildDayjs } from "@metriport/shared/common/date";
import { Bundle, MedicationRequest } from "@medplum/fhirtypes";
import { dangerouslyDeduplicateFhir } from "@metriport/core/fhir-deduplication/deduplicate-fhir";
import { HistoryData, historyPage } from "./history-table";
import { Medication, Organization } from "@medplum/fhirtypes";

export const DR_FIRST_DIR = path.join(process.cwd(), "runs", "drfirst");
const CX_ID = process.env.TARGET_COMPARISON_CX_ID ?? "";

const program = new Command();

program.name("dr-first").description("Run the comparison of Dr First to Metriport").action(main);

async function main() {
  console.log("Running comparison of Dr First to Metriport");
  if (!CX_ID) throw new Error("TARGET_COMPARISON_CX_ID is not set");

  const patientIdMap = getPatientIdMapping();
  const nameIds = getDrFirstOutputNameIds();

  const csvOutput: Array<Array<string | number>> = [
    ["nameId", "drFirstMedications", "drFirstFills", "metriportMedications", "metriportFills"],
  ];
  for (const nameId of nameIds) {
    const patientId = patientIdMap[nameId];
    if (!patientId) throw new Error(`Patient ID not found for ${nameId}`);

    const drFirstOutput = getDrFirstOutput(nameId);
    const metriportBundle = getMetriportBundle(nameId);
    dangerouslyDeduplicateFhir(metriportBundle, CX_ID, patientId);
    writeDrFirstHtml(nameId, drFirstOutput);
    writeMetriportHtml(nameId, metriportBundle);
    const drFirstStatistics = computeDrFirstStatistics(drFirstOutput);
    const metriportStatistics = computeMetriportStatistics(metriportBundle);
    csvOutput.push([
      nameId,
      drFirstStatistics.medications,
      drFirstStatistics.fills,
      metriportStatistics.medications,
      metriportStatistics.fills,
    ]);
  }
  fs.writeFileSync(
    path.join(DR_FIRST_DIR, "count.csv"),
    csvOutput.map(row => row.join(",")).join("\n"),
    "utf-8"
  );
}

function computeDrFirstStatistics(drFirstOutput: DrFirstOutput) {
  let totalFills = 0;
  const seenFill = new Set<string>();
  drFirstOutput.medications.forEach(medication => {
    medication.fills.forEach(fill => {
      const fillKey = `${fill.dateWritten}-${fill.sig}-${fill.daysSupply}-${fill.drugName}`;
      if (!seenFill.has(fillKey)) {
        totalFills++;
        seenFill.add(fillKey);
      }
    });
  });

  const statistics = {
    medications: drFirstOutput.medications.length,
    fills: totalFills,
  };
  return statistics;
}

function getDrFirstHistoryData(nameId: string, drFirstOutput: DrFirstOutput): HistoryData {
  const historyData: HistoryData = {
    nameId,
    events: [],
  };
  drFirstOutput.medications.forEach(medication => {
    medication.fills.forEach(fill => {
      historyData.events.push({
        dateWritten: fill.dateWritten
          ? buildDayjs(fill.dateWritten, "MM/DD/YYYY").toISOString()
          : "",
        soldDate: fill.soldDate,
        medicationName: medication.genericName,
        medicationNdc: medication.ndcId,
        daysSupply: fill.daysSupply,
        directions: fill.sig,
        pharmacyName: fill.pharmacy?.name ?? "",
      });
    });
  });

  historyData.events.sort((a, b) => {
    const dateDiff = buildDayjs(a.dateWritten).diff(buildDayjs(b.dateWritten));
    if (dateDiff === 0) {
      return a.medicationName.localeCompare(b.medicationName);
    }
    return dateDiff;
  });

  for (let i = 0; i < historyData.events.length; i++) {
    const event = historyData.events[i];
    const nextEvent = historyData.events[i + 1];
    if (
      nextEvent &&
      buildDayjs(event.dateWritten).isSame(buildDayjs(nextEvent.dateWritten)) &&
      event.medicationName == nextEvent.medicationName &&
      event.medicationNdc == nextEvent.medicationNdc &&
      event.daysSupply == nextEvent.daysSupply &&
      event.directions == nextEvent.directions
    ) {
      historyData.events.splice(i + 1, 1);
      i--;
    }
  }

  return historyData;
}

function writeDrFirstHtml(nameId: string, output: DrFirstOutput) {
  const historyData = getDrFirstHistoryData(nameId, output);
  const outputHtml = historyPage(historyData);
  fs.writeFileSync(path.join(DR_FIRST_DIR, "html", nameId + "-drfirst.html"), outputHtml, "utf-8");
}

function computeMetriportStatistics(metriportBundle: Bundle) {
  const statistics = {
    medications: 0,
    fills: 0,
  };
  metriportBundle.entry?.forEach(entry => {
    if (entry.resource?.resourceType === "Medication") {
      statistics.medications++;
    }
    if (entry.resource?.resourceType === "MedicationDispense") {
      statistics.fills++;
    }
  });
  return statistics;
}

function getMetriportHistoryData(nameId: string, metriportBundle: Bundle): HistoryData {
  const historyData: HistoryData = {
    nameId,
    events: [],
  };

  const medicationMap = new Map<string, { name: string; ndc: string }>();
  const medicationRequestMap = new Map<string, { authoredOn: string }>();
  const organizationMap = new Map<string, { name: string }>();
  metriportBundle.entry?.forEach(({ resource }) => {
    if (resource?.resourceType === "Medication" && resource.id) {
      const medication = resource as Medication;
      const ndc = medication.code?.coding?.find(
        c => c.system === "http://hl7.org/fhir/sid/ndc"
      )?.code;
      medicationMap.set("Medication/" + resource.id, {
        name: medication.code?.text ?? "",
        ndc: ndc ?? "",
      });
    }
    if (resource?.resourceType === "Organization" && resource.id) {
      const organization = resource as Organization;
      organizationMap.set("Organization/" + resource.id, { name: organization.name ?? "" });
    }
    if (resource?.resourceType === "MedicationRequest" && resource.id) {
      const medicationRequest = resource as MedicationRequest;
      medicationRequestMap.set("MedicationRequest/" + resource.id, {
        authoredOn: medicationRequest.authoredOn ?? "",
      });
    }
  });

  metriportBundle.entry?.forEach(({ resource }) => {
    if (resource?.resourceType === "MedicationDispense") {
      const medication = medicationMap.get(resource.medicationReference?.reference ?? "");
      if (!medication) {
        throw new Error(`Medication not found for ${resource.medicationReference?.reference}`);
      }
      const medicationRequest = medicationRequestMap.get(
        resource.authorizingPrescription?.[0].reference ?? ""
      );
      let pharmacyName = "";
      if (resource.performer) {
        const performer = resource.performer[0].actor;
        if (performer && performer.reference) {
          const organization = organizationMap.get(performer.reference);
          pharmacyName = organization?.name ?? "";
        }
      }

      historyData.events.push({
        dateWritten: medicationRequest?.authoredOn ?? "",
        soldDate: resource.whenHandedOver ?? "",
        medicationName: medication.name ?? "",
        medicationNdc: medication.ndc ?? "",
        daysSupply: resource.daysSupply?.value?.toString() ?? "",
        directions: resource.note?.[0]?.text ?? "",
        pharmacyName,
      });
    }
  });
  return historyData;
}

function writeMetriportHtml(nameId: string, metriportBundle: Bundle) {
  const historyData = getMetriportHistoryData(nameId, metriportBundle);
  const outputHtml = historyPage(historyData);
  fs.writeFileSync(
    path.join(DR_FIRST_DIR, "html", nameId + "-metriport.html"),
    outputHtml,
    "utf-8"
  );
}

export function getPatientIdMapping(): Record<string, string> {
  const mapping = JSON.parse(fs.readFileSync(path.join(DR_FIRST_DIR, "mapping.json"), "utf8"));
  return mapping;
}

export function getDrFirstOutputNameIds() {
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

function getMetriportBundle(nameId: string): Bundle {
  const bundle = JSON.parse(
    fs.readFileSync(path.join(DR_FIRST_DIR, "bundle", nameId + ".json"), "utf8")
  );
  return bundle;
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
