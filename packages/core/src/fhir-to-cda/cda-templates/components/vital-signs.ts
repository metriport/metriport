import { Bundle, Observation, Quantity } from "@medplum/fhirtypes";
import { VitalSignsSection } from "../../cda-types/sections";
import { ObservationOrganizer, ObservationTableRow } from "../../cda-types/shared-types";
import { isVitalSignsObservation } from "../../fhir";
import {
  buildCodeCe,
  buildInstanceIdentifier,
  buildTemplateIds,
  formatDateToCdaTimestamp,
  formatDateToHumanReadableFormat,
  notOnFilePlaceholder,
  withNullFlavor,
} from "../commons";
import { extensionValue2014, loincCodeSystem, loincSystemName, oids } from "../constants";
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
  const vitalSignsSection: VitalSignsSection = {
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
    text: notOnFilePlaceholder,
  };

  const vitalSignsObservations: Observation[] =
    fhirBundle.entry?.flatMap(entry =>
      isVitalSignsObservation(entry.resource) ? [entry.resource] : []
    ) || [];

  if (vitalSignsObservations.length === 0) {
    return {
      _nullFlavor: "NI",
      ...vitalSignsSection,
    };
  }

  const augmentedObservations = createAugmentedVitalObservations(vitalSignsObservations);
  const { trs, entries } = createTableRowsAndEntries(augmentedObservations);
  const table = initiateSectionTable(sectionName, tableHeaders, trs);

  vitalSignsSection.text = table;
  vitalSignsSection.entry = entries;

  return vitalSignsSection;
}

function createTableRowsAndEntries(augObs: AugmentedObservation[]): {
  trs: ObservationTableRow[];
  entries: ObservationOrganizer[];
} {
  const obsGroupedByDateMap = new Map<string, AugmentedObservation[]>();

  augObs.map(obs => {
    if (!obs.measurement?.date) return;
    if (obsGroupedByDateMap.get(obs.measurement.date)) {
      const vitals = obsGroupedByDateMap.get(obs.measurement.date);
      const vitalsSoFar = vitals ? [...vitals, obs] : [obs];
      obsGroupedByDateMap.set(obs.measurement.date, vitalsSoFar);
    } else {
      obsGroupedByDateMap.set(obs.measurement.date, [obs]);
    }
  });

  const trs: ObservationTableRow[] = [];
  const entries: ObservationOrganizer[] = [];
  let index = -1;
  obsGroupedByDateMap.forEach((set, date) => {
    index++;
    const referenceId = `${sectionName}${index}`;
    trs.push(createTableRow(set, date, referenceId));
    entries.push(createOrganizedEntryFromSet(set, date, referenceId));
  });

  return { trs, entries };
}

function createTableRow(set: AugmentedObservation[], date: string, referenceId: string) {
  return {
    tr: {
      _ID: referenceId,
      ["td"]: [
        {
          "#text": date,
        },
        {
          "#text":
            set.find(obs => obs.measurement?.category === "body temperature")?.measurement?.value ??
            "-",
        },
        {
          "#text":
            set.find(obs => obs.measurement?.category === "heart rate")?.measurement?.value ?? "-",
        },
        {
          "#text":
            set.find(obs => obs.measurement?.category === "respiratory rate")?.measurement?.value ??
            "-",
        },
        {
          "#text": set.find(obs => obs.measurement?.category === "spo2")?.measurement?.value ?? "-",
        },
        {
          "#text":
            set.find(obs => obs.measurement?.category === "diastolic blood pressure")?.measurement
              ?.value ?? "-",
        },
        {
          "#text":
            set.find(obs => obs.measurement?.category === "systolic blood pressure")?.measurement
              ?.value ?? "-",
        },
        {
          "#text":
            set.find(obs => obs.measurement?.category === "body weight")?.measurement?.value ?? "-",
        },
        {
          "#text":
            set.find(obs => obs.measurement?.category === "body height")?.measurement?.value ?? "-",
        },
        {
          "#text": set.find(obs => obs.measurement?.category === "bmi")?.measurement?.value ?? "-",
        },
        {
          "#text":
            set.find(obs => obs.measurement?.category === "pain severity")?.measurement?.value ??
            "-",
        },
      ],
    },
  };
}

function createOrganizedEntryFromSet(
  set: AugmentedObservation[],
  date: string,
  referenceId: string
): ObservationOrganizer {
  return {
    _typeCode: "DRIV",
    organizer: {
      _classCode: "CLUSTER",
      _moodCode: "EVN",
      templateId: buildTemplateIds({
        root: oids.vitalSignsOrganizer,
        extension: extensionValue2014,
      }),
      id: withNullFlavor(undefined, "_value"),
      code: buildCodeCe({
        code: "46680005",
        codeSystem: "2.16.840.1.113883.6.96",
        codeSystemName: "SNOMED CT",
        displayName: "Vital signs",
      }),
      statusCode: {
        _code: "completed",
      },
      effectiveTime: {
        low: withNullFlavor(formatDateToCdaTimestamp(date), "_value"),
      },
      component: set.map(obs => createEntriesFromObservation(obs, referenceId)),
    },
  };
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
