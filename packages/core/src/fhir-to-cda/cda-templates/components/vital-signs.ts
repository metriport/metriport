import { Bundle, Observation, Quantity } from "@medplum/fhirtypes";
import { VitalSignsSection } from "../../cda-types/sections";
import { ObservationTableRow } from "../../cda-types/shared-types";
import { isVitalSignsObservation } from "../../fhir";
import {
  buildCodeCe,
  buildInstanceIdentifier,
  formatDateToCdaTimestamp,
  formatDateToHumanReadableFormat,
} from "../commons";
import { loincCodeSystem, loincSystemName, oids } from "../constants";
import { initiateSectionTable } from "../table";
import { AugmentedObservation, VitalObservation } from "./augmented-resources";
import { createEntriesFromObservation } from "./observations";

const vitalSignCodesMap = new Map<string, string>();
vitalSignCodesMap.set("8310-5", "body temperature");
vitalSignCodesMap.set("8867-4", "heart rate");
vitalSignCodesMap.set("9279-1", "respiratory rate");
vitalSignCodesMap.set("2708-6", "spo2");
vitalSignCodesMap.set("8462-4", "diastolic blood pressure");
vitalSignCodesMap.set("8480-6", "systolic blood pressure");
vitalSignCodesMap.set("29463-7", "body weight");
vitalSignCodesMap.set("8302-2", "body height");
vitalSignCodesMap.set("39156-5", "bmi");
vitalSignCodesMap.set("72514-3", "pain severity");

const sectionName = "vitalsigns";
const tableHeaders = [
  "Date Recorded",
  "Temperature",
  "Pulse",
  "Respiratory Rate",
  "Oxygen Saturation (SpO2)",
  "Diastolic Blood Pressure",
  "Systolic Blood Pressure",
  "Weight",
  "Height",
  "Body Mass Index (BMI)",
  "Pain Severity",
];

export function buildVitalSigns(fhirBundle: Bundle): VitalSignsSection {
  const vitalSignsObservations: Observation[] =
    fhirBundle.entry?.flatMap(entry =>
      isVitalSignsObservation(entry.resource) ? [entry.resource] : []
    ) || [];

  if (vitalSignsObservations.length === 0) {
    return undefined;
  }

  const augmentedObservations = createAugmentedVitalObservations(vitalSignsObservations);
  const trs = createTableRows(augmentedObservations);
  const table = initiateSectionTable(sectionName, tableHeaders, trs);

  const entries = augmentedObservations.map((obs, index) =>
    createEntriesFromObservation(obs, `${sectionName}${index}`)
  ); // TODO: Wrap this in a vital signs organizer: 2.16.840.1.113883.10.20.22.4.26

  const vitalSignsSection = {
    templateId: buildInstanceIdentifier({
      root: oids.vitalSignsSection,
    }),
    code: buildCodeCe({
      code: "8716-3",
      codeSystem: loincCodeSystem,
      codeSystemName: loincSystemName,
      displayName: "Vital Signs",
    }),
    title: "VITAL SIGNS",
    text: table,
    entry: entries,
  };
  return vitalSignsSection;
}

function createTableRows(augObs: AugmentedObservation[]) {
  const mapByDate = new Map<string, VitalObservation[]>();

  augObs.map(obs => {
    if (!obs.measurement?.date) return;
    if (mapByDate.get(obs.measurement.date)) {
      const vitals = mapByDate.get(obs.measurement.date);
      const vitalsSoFar = vitals ? [...vitals, obs.measurement] : [obs.measurement];
      mapByDate.set(obs.measurement.date, vitalsSoFar);
    } else {
      mapByDate.set(obs.measurement.date, [obs.measurement]);
    }
  });

  const trs: ObservationTableRow[] = [];
  let index = -1;
  mapByDate.forEach((set, date) => {
    index++;
    const referenceId = `${sectionName}${index}`;
    const row = {
      tr: {
        _ID: referenceId,
        ["td"]: [
          {
            "#text": date,
          },
          {
            "#text": set.find(obs => obs.category === "body temperature")?.value ?? "-",
          },
          {
            "#text": set.find(obs => obs.category === "heart rate")?.value ?? "-",
          },
          {
            "#text": set.find(obs => obs.category === "respiratory rate")?.value ?? "-",
          },
          {
            "#text": set.find(obs => obs.category === "spo2")?.value ?? "-",
          },
          {
            "#text": set.find(obs => obs.category === "diastolic blood pressure")?.value ?? "-",
          },
          {
            "#text": set.find(obs => obs.category === "systolic blood pressure")?.value ?? "-",
          },
          {
            "#text": set.find(obs => obs.category === "body weight")?.value ?? "-",
          },
          {
            "#text": set.find(obs => obs.category === "body height")?.value ?? "-",
          },
          {
            "#text": set.find(obs => obs.category === "bmi")?.value ?? "-",
          },
          {
            "#text": set.find(obs => obs.category === "pain severity")?.value ?? "-",
          },
        ],
      },
    };

    trs.push(row);
  });

  return trs;
}

function createAugmentedVitalObservations(observations: Observation[]): AugmentedObservation[] {
  return observations.map(obs => {
    const dateString = formatDateToCdaTimestamp(obs.effectiveDateTime);
    const formattedDate = formatDateToHumanReadableFormat(dateString);
    const code = obs.code?.coding?.[0]?.code;
    const value = getValueFromValueQuantity(obs.valueQuantity);
    const category = code ? vitalSignCodesMap.get(code) : undefined;
    if (!value || !category || !formattedDate) {
      return new AugmentedObservation(sectionName, obs, oids.vitalSignsObs);
    }

    const vitalObs: VitalObservation = {
      value,
      category,
      date: formattedDate,
      dateTime: dateString,
    };
    return new AugmentedObservation(sectionName, obs, oids.vitalSignsObs, vitalObs);
  });
}

function getValueFromValueQuantity(valueQuantity: Quantity | undefined) {
  return `${valueQuantity?.value} ${valueQuantity?.unit}`;
}
