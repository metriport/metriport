import { Bundle, Medication, MedicationStatement, Resource } from "@medplum/fhirtypes";
import { ObservationTableRow, SubstanceAdministationEntry } from "../../cda-types/shared-types";
import { findResourceInBundle } from "../../fhir";
import {
  buildCodeCe,
  buildCodeCvFromCodeableConcept,
  buildInstanceIdentifier,
  formatDateToCdaTimestamp,
  formatDateToHumanReadableFormat,
  initiateSectionTable,
  withoutNullFlavorObject,
} from "../commons";
import {
  NOT_SPECIFIED,
  _classCodeAttribute,
  _codeAttribute,
  _idAttribute,
  _inlineTextAttribute,
  _moodCodeAttribute,
  _typeCodeAttribute,
  _valueAttribute,
  _xsiTypeAttribute,
  extensionValue2014,
  loincCodeSystem,
  loincSystemName,
  placeholderOrgOid,
} from "../constants";
import { createTableRowsAndEntries } from "../create-table-rows-and-entries";
import { AugmentedMedicationStatement } from "./augmented-resources";

const medicationsSectionName = "medications";
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
    return new AugmentedMedicationStatement(statement, medicationsSectionName, medication);
  });

  const { trs, entries } = createTableRowsAndEntries(
    augmentedMedStatements,
    createTableRowsFromMedicationStatements,
    createEntryFromStatement
  );

  const table = initiateSectionTable(medicationsSectionName, tableHeaders, trs);

  const medicationsSection = {
    component: {
      section: {
        templateId: buildInstanceIdentifier({
          root: "2.16.840.1.113883.10.20.22.2.1.1",
        }),
        code: buildCodeCe({
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
      [_idAttribute]: referenceId,
      ["td"]: [
        {
          [_inlineTextAttribute]: medicationName,
        },
        {
          [_inlineTextAttribute]: getDosageFromMedicationStatement(statement.resource),
        },
        {
          [_inlineTextAttribute]: getFrequencyFromMedicationStatement(statement.resource),
        },
        {
          [_inlineTextAttribute]: formatDateToHumanReadableFormat(period.start) ?? NOT_SPECIFIED,
        },
        {
          [_inlineTextAttribute]: formatDateToHumanReadableFormat(period.end) ?? NOT_SPECIFIED,
        },
        {
          [_inlineTextAttribute]: statement.resource.reasonCode?.[0]?.text ?? NOT_SPECIFIED,
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
  const manufacturedMaterialCode = buildCodeCvFromCodeableConcept(
    statement.medication?.code,
    referenceId
  );
  return [
    {
      substanceAdministration: {
        [_classCodeAttribute]: "SBADM",
        [_moodCodeAttribute]: "INT",
        templateId: buildInstanceIdentifier({
          root: statement.typeOid,
          extension: extensionValue2014,
        }),
        id: buildInstanceIdentifier({
          root: placeholderOrgOid,
          extension: statement.resource.id,
        }),
        statusCode: {
          [_codeAttribute]: statement.resource.status,
        },
        effectiveTime: {
          [_xsiTypeAttribute]: "IVL_TS",
          low: withoutNullFlavorObject(
            formatDateToCdaTimestamp(statement.resource.effectivePeriod?.start),
            _valueAttribute
          ),
          high: withoutNullFlavorObject(
            formatDateToCdaTimestamp(statement.resource.effectivePeriod?.end),
            _valueAttribute
          ),
        },
        consumable: {
          [_typeCodeAttribute]: "CSM",
          manufacturedProduct: {
            templateId: buildInstanceIdentifier({
              root: "2.16.840.1.113883.10.20.22.4.23",
              extension: "2014-06-09",
            }),
            manufacturedMaterial: {
              code: manufacturedMaterialCode,
            },
          },
        },
      },
    },
  ];
}
