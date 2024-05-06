import { Bundle, Medication, MedicationStatement, Resource } from "@medplum/fhirtypes";
import { findResourceInBundle } from "../../fhir";
import {
  buildCodeCE,
  buildCodeCVFromCodeableConcept,
  buildInstanceIdentifier,
  createTableHeader,
  formatDateToCDATimeStamp,
  formatDateToHumanReadableFormat,
  withoutNullFlavorObject,
} from "../commons";
import {
  classCodeAttribute,
  codeAttribute,
  extensionValue2014,
  idAttribute,
  inlineTextAttribute,
  loincCodeSystem,
  loincSystemName,
  moodCodeAttribute,
  placeholderOrgOid,
  typeCodeAttribute,
  valueAttribute,
} from "../constants";
import { createTableRowsAndEntries } from "../create-table-rows-and-entries";
import { ObservationTableRow, SubstanceAdministationEntry } from "../types";
import { AugmentedMedicationStatement } from "./augmented-resources";

const sectionName = "medications";
const tableHeaders = ["Medication", "Dosage", "Frequency", "Start Date", "End Date", "Reason"];

export function buildMedications(fhirBundle: Bundle) {
  const medicationStatements: MedicationStatement[] =
    fhirBundle.entry?.flatMap(entry =>
      isMedicationStatement(entry.resource) ? [entry.resource] : []
    ) || [];

  if (medicationStatements.length === 0) {
    return undefined;
  }

  const augmentedMedStatements = medicationStatements.map(statement => {
    const ref = statement.medicationReference?.reference;
    const refResource = ref ? findResourceInBundle(fhirBundle, ref) : undefined;
    const medication = isMedication(refResource) ? refResource : undefined;
    return new AugmentedMedicationStatement(statement, medication);
  });

  const { trs, entries } = createTableRowsAndEntries(
    augmentedMedStatements,
    createTableRowsFromMedicationStatements,
    createEntryFromStatement
  );

  const table = {
    [idAttribute]: sectionName,
    thead: createTableHeader(tableHeaders),
    tbody: {
      tr: trs.map(row => ({
        [idAttribute]: row.tr[idAttribute],
        td: row.tr.td,
      })),
    },
  };

  const medicationsSection = {
    component: {
      section: {
        templateId: buildInstanceIdentifier({
          root: "2.16.840.1.113883.10.20.22.2.1.1",
        }),
        code: buildCodeCE({
          code: "10160-0",
          codeSystem: loincCodeSystem,
          codeSystemName: loincSystemName,
          displayName: "History of Medication use Narrative",
        }),
        title: "MEDICATIONS",
        text: { table },
        entry: entries,
      },
    },
  };
  return medicationsSection;
}

function isMedicationStatement(resource: Resource | undefined): resource is MedicationStatement {
  return resource?.resourceType === "MedicationStatement";
}

function isMedication(resource: Resource | undefined): resource is Medication {
  return resource?.resourceType === "Medication";
}

function createTableRowsFromMedicationStatements(
  statement: AugmentedMedicationStatement,
  medicationsPrefix: string
): ObservationTableRow[] {
  const trs: ObservationTableRow[] = [];
  const tableRow = createTableRowFromObservation(statement, medicationsPrefix);
  if (tableRow) trs.push(tableRow);
  return trs;
}

function createTableRowFromObservation(
  statement: AugmentedMedicationStatement,
  referenceId: string
): ObservationTableRow | undefined {
  const period = {
    start: statement.resource?.effectivePeriod?.start,
    end: statement?.resource?.effectivePeriod?.end,
  };
  const medicationName = statement.medication?.code?.text;
  if (!medicationName) return;

  return {
    tr: {
      [idAttribute]: referenceId,
      ["td"]: [
        {
          [inlineTextAttribute]: medicationName,
        },
        {
          [inlineTextAttribute]: getDosageFromMedicationStatement(statement.resource),
        },
        {
          [inlineTextAttribute]: getFrequencyFromMedicationStatement(statement.resource),
        },
        {
          [inlineTextAttribute]: formatDateToHumanReadableFormat(period.start) ?? "Not Specified",
        },
        {
          [inlineTextAttribute]: formatDateToHumanReadableFormat(period.end) ?? "Not Specified",
        },
        {
          [inlineTextAttribute]: statement.resource.reasonCode?.[0]?.text ?? "Not Specified",
        },
      ],
    },
  };
}

function getDosageFromMedicationStatement(statement: MedicationStatement): string {
  const dosageValue = statement.dosage?.[0]?.doseAndRate?.[0]?.doseQuantity?.value;
  const dosageUnit = statement.dosage?.[0]?.doseAndRate?.[0]?.doseQuantity?.unit;
  return `${dosageValue} ${dosageUnit}`;
}

function getFrequencyFromMedicationStatement(statement: MedicationStatement): string {
  const rateValue = statement.dosage?.[0]?.doseAndRate?.[0]?.rateQuantity?.value;
  const rateUnit = statement.dosage?.[0]?.doseAndRate?.[0]?.rateQuantity?.unit;
  return `${rateValue} ${rateUnit}`;
}

function createEntryFromStatement(
  statement: AugmentedMedicationStatement,
  referenceId: string
): SubstanceAdministationEntry[] {
  return [
    {
      substanceAdministration: {
        [classCodeAttribute]: "SBADM",
        [moodCodeAttribute]: "INT",
        templateId: buildInstanceIdentifier({
          root: statement.typeOid,
          extension: extensionValue2014,
        }),
        id: buildInstanceIdentifier({
          root: placeholderOrgOid,
          extension: statement.resource.id,
        }),
        statusCode: {
          [codeAttribute]: statement.resource.status,
        },
        effectiveTime: {
          low: withoutNullFlavorObject(
            formatDateToCDATimeStamp(statement.resource.effectivePeriod?.start),
            valueAttribute
          ),
          high: withoutNullFlavorObject(
            formatDateToCDATimeStamp(statement.resource.effectivePeriod?.end),
            valueAttribute
          ),
        },
        consumable: {
          [typeCodeAttribute]: "CSM",
          manufacturedProduct: {
            [codeAttribute]: "MANU",
            templateId: buildInstanceIdentifier({
              root: "2.16.840.1.113883.10.20.22.4.23",
              extension: "2014-06-09",
            }),
            manufacturedMaterial: {
              code: buildCodeCVFromCodeableConcept(statement.medication?.code, referenceId),
            },
          },
        },
      },
    },
  ];
}
