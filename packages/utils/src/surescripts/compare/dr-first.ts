import { Command } from "commander";
import fs from "fs";
import path from "path";
import { buildDayjs } from "@metriport/shared/common/date";
import { crosswalkNdcToRxNorm } from "@metriport/core/external/term-server/index";
import {
  Bundle,
  MedicationRequest,
  Resource,
  Extension,
  MedicationDispense,
} from "@medplum/fhirtypes";
import { dangerouslyDeduplicateFhir } from "@metriport/core/fhir-deduplication/deduplicate-fhir";
import { HistoryData, historyPage } from "./history-table";
import { Medication, Organization } from "@medplum/fhirtypes";
import { getConsolidatedBundle } from "../shared";

export const DR_FIRST_DIR = path.join(process.cwd(), "runs", "drfirst");
const CX_ID = process.env.TARGET_COMPARISON_CX_ID ?? "";

const program = new Command();

program
  .name("dr-first")
  .description("Run the comparison of Dr First to Metriport")
  .option("--include-hie", "Include HIE data in the comparison")
  .option("--hie-only", "Remove Surescripts data from the comparison")
  .option("--start-date <startDate>", "Start date for the comparison")
  .option("--compare-rxnorm", "Compare RxNorms")
  .action(main);

async function main({
  includeHie,
  hieOnly,
  startDate,
  compareRxnorm,
}: {
  includeHie?: boolean;
  hieOnly?: boolean;
  startDate?: string;
  compareRxnorm?: boolean;
}) {
  console.log("Running comparison of Dr First to Metriport");
  if (!CX_ID) throw new Error("TARGET_COMPARISON_CX_ID is not set");

  const patientIdMap = getPatientIdMapping();
  const nameIds = getDrFirstOutputNameIds();
  const responsePbmCount = new Map<string, number>();
  let compareRxnormCount = 0;
  let compareRxnormTotal = 0;

  const csvOutput: Array<Array<string | number>> = [
    ["nameId", "drFirstMedications", "drFirstFills", "metriportMedications", "metriportFills"],
  ];

  const csvCoverageOutput: Array<Array<string | number>> = [
    ["nameId", "drFirstRxNorms", "metriportRxNorms", "sharedRxNorms"],
  ];
  for (const nameId of nameIds) {
    const patientId = patientIdMap[nameId];
    if (!patientId) throw new Error(`Patient ID not found for ${nameId}`);

    const drFirstOutput = getDrFirstOutput(nameId);
    const metriportBundle = getMetriportBundle(nameId);

    // Include consolidated bundle
    if (includeHie || hieOnly) {
      const consolidatedBundle = await getConsolidatedBundle(CX_ID, patientId);
      if (consolidatedBundle && metriportBundle.entry && consolidatedBundle.entry) {
        console.log(`Adding ${consolidatedBundle.entry.length} consolidated entries for ${nameId}`);
        metriportBundle.entry.push(...consolidatedBundle.entry);
      } else {
        console.log(`No consolidated bundle found for ${nameId}`);
      }

      if (hieOnly) {
        const originalEntryCount = metriportBundle.entry?.length ?? 0;
        metriportBundle.entry = metriportBundle.entry?.filter(
          entry => !isSurescriptsResource(entry.resource)
        );
        const finalEntryCount = metriportBundle?.entry?.length ?? 0;
        console.log(
          `Removed ${originalEntryCount - finalEntryCount} Surescripts entries for ${nameId}`
        );
      }
    }

    if (startDate) {
      // console.log(`Filtering bundle for ${nameId} to medication resources after ${startDate}`);
      const threshold = buildDayjs(startDate);
      metriportBundle.entry = metriportBundle.entry?.filter(entry => {
        if (entry.resource?.resourceType === "MedicationDispense") {
          const medicationDispense = entry.resource as MedicationDispense;
          if (medicationDispense.whenHandedOver) {
            const handedOver = buildDayjs(medicationDispense.whenHandedOver);
            return handedOver.isAfter(threshold);
          }
        }
        if (entry.resource?.meta?.lastUpdated) {
          const lastUpdated = buildDayjs(entry.resource.meta.lastUpdated);
          return lastUpdated.isAfter(threshold);
        }
        return true;
      });
      writeMetriportBundle(nameId, metriportBundle);
    }

    try {
      dangerouslyDeduplicateFhir(metriportBundle, CX_ID, patientId);
    } catch (error) {
      console.error(`Error deduplicating ${nameId}'s bundle`);
    }
    writeDrFirstHtml(nameId, drFirstOutput);
    writeMetriportHtml(nameId, metriportBundle);
    const drFirstStatistics = computeDrFirstStatistics(drFirstOutput, responsePbmCount);
    const metriportStatistics = computeMetriportStatistics(metriportBundle);
    csvOutput.push([
      nameId,
      drFirstStatistics.medications,
      drFirstStatistics.fills,
      metriportStatistics.medications,
      metriportStatistics.fills,
    ]);

    if (compareRxnorm) {
      const drFirstEvents = getDrFirstHistoryData(nameId, drFirstOutput).events;
      const metriportRxNorms = getMetriportBundleRxNorms(metriportBundle);
      const { drFirstRxNorms, sharedRxNorms } = await getDrFirstRxNorms(
        drFirstEvents,
        metriportRxNorms
      );

      if (drFirstRxNorms.size > 0) {
        compareRxnormCount += sharedRxNorms.size;
        compareRxnormTotal += drFirstRxNorms.size;
      }
      console.log(
        `${nameId}: Dr First: ${drFirstRxNorms.size} -> ${sharedRxNorms.size} overlap <- Metriport: ${metriportRxNorms.size}`
      );
      csvCoverageOutput.push([
        nameId,
        drFirstRxNorms.size,
        metriportRxNorms.size,
        sharedRxNorms.size,
      ]);
    }
  }

  const countFileName = buildCsvFileName("count", { includeHie, hieOnly, startDate });
  writeCsvFile(path.join(DR_FIRST_DIR, countFileName), csvOutput);

  if (compareRxnorm) {
    const coverageFileName = buildCsvFileName("coverage", { includeHie, hieOnly, startDate });
    writeCsvFile(path.join(DR_FIRST_DIR, coverageFileName), csvCoverageOutput);

    console.log(
      `${compareRxnormCount} / ${compareRxnormTotal} = ${Math.round(
        (100 * compareRxnormCount) / compareRxnormTotal
      )}%`
    );
  }
}

function buildCsvFileName(
  name: string,
  {
    includeHie,
    hieOnly,
    startDate,
  }: { includeHie?: boolean; hieOnly?: boolean; startDate?: string }
) {
  if (includeHie || hieOnly) {
    if (hieOnly) {
      return `${name}-hie-only${startDate ? `-${startDate}` : ""}.csv`;
    }
    return `${name}-with-hie${startDate ? `-${startDate}` : ""}.csv`;
  }
  if (startDate) {
    return `${name}-${startDate}.csv`;
  }
  return `${name}.csv`;
}

function writeCsvFile(filePath: string, data: Array<Array<string | number>>) {
  fs.writeFileSync(filePath, data.map(row => row.join(",")).join("\n"), "utf-8");
}

function computeDrFirstStatistics(
  drFirstOutput: DrFirstOutput,
  responsePbmCount: Map<string, number>
) {
  let totalFills = 0;
  const seenFill = new Set<string>();
  drFirstOutput.medications.forEach(medication => {
    medication.fills.forEach(fill => {
      const fillKey = `${fill.dateWritten}-${fill.soldDate ?? fill.fillDate}-${fill.sig}-${
        fill.daysSupply
      }-${fill.drugName}`;
      if (!seenFill.has(fillKey)) {
        totalFills++;
        seenFill.add(fillKey);
        if (fill.responsePbmName) {
          responsePbmCount.set(
            fill.responsePbmName,
            (responsePbmCount.get(fill.responsePbmName) ?? 0) + 1
          );
        }
      }
    });
  });

  const statistics = {
    medications: drFirstOutput.medications.length,
    fills: totalFills,
    responsePbmCount: Object.fromEntries(responsePbmCount),
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
        soldDate: fill.soldDate
          ? buildDayjs(fill.soldDate, "MM/DD/YYYY").toISOString()
          : fill.fillDate
          ? buildDayjs(fill.fillDate, "MM/DD/YYYY").toISOString()
          : "",
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

function isSurescriptsResource(resource?: Resource): boolean {
  if (resource == null) return false;
  if ("extension" in resource && resource.extension != null) {
    return resource.extension.some(isSurescriptsExtension);
  }
  return false;
}

function isSurescriptsExtension(extension?: Extension): boolean {
  if (extension == null) return false;
  return extension.valueCoding?.code === "SURESCRIPTS";
}

function writeDrFirstHtml(nameId: string, output: DrFirstOutput) {
  const historyData = getDrFirstHistoryData(nameId, output);
  const outputHtml = historyPage(historyData);
  fs.writeFileSync(path.join(DR_FIRST_DIR, "html", nameId + "-drfirst.html"), outputHtml, "utf-8");
}

function writeMetriportBundle(nameId: string, metriportBundle: Bundle): void {
  fs.writeFileSync(
    path.join(DR_FIRST_DIR, "latest-bundle", nameId + ".json"),
    JSON.stringify(metriportBundle, null, 2),
    "utf-8"
  );
}

function getMetriportBundleRxNorms(metriportBundle: Bundle): Set<string> {
  const metriportRxNorms = new Set<string>();
  for (const entry of metriportBundle.entry ?? []) {
    if (entry.resource?.resourceType === "Medication") {
      const medication = entry.resource as Medication;
      const rxNormCoding = medication.code?.coding?.find(
        c => c.system === "http://www.nlm.nih.gov/research/umls/rxnorm"
      );
      if (rxNormCoding && rxNormCoding.code) {
        metriportRxNorms.add(rxNormCoding.code);
      }
    }
  }
  return metriportRxNorms;
}

async function getDrFirstRxNorms(
  drFirstEvents: HistoryData["events"],
  metriportRxNorms: Set<string>
): Promise<{ drFirstRxNorms: Set<string>; sharedRxNorms: Set<string> }> {
  const drFirstRxNorms = new Set<string>();
  const sharedRxNorms = new Set<string>();

  for (const event of drFirstEvents) {
    if (event.medicationNdc) {
      const ndc = event.medicationNdc;
      const rxNorm = await crosswalkNdcToRxNorm(ndc);
      if (rxNorm && rxNorm.code) {
        drFirstRxNorms.add(rxNorm.code);
        if (metriportRxNorms.has(rxNorm.code)) {
          sharedRxNorms.add(rxNorm.code);
        }
      }
    }
  }

  return { drFirstRxNorms, sharedRxNorms };
}

function computeMetriportStatistics(metriportBundle: Bundle) {
  const statistics = {
    medications: 0,
    fills: 0,
  };
  metriportBundle.entry?.forEach(entry => {
    if (entry.resource?.meta?.lastUpdated) {
      const lastUpdated = buildDayjs(entry.resource.meta.lastUpdated);
      if (lastUpdated.isBefore(buildDayjs("2024-07-01"))) {
        return;
      }
    }
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

      if (!medicationRequest?.authoredOn) {
        // console.log("missing authored on", nameId, medicationRequest);
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
