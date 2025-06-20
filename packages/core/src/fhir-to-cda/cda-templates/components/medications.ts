import { Bundle, Dosage, DosageDoseAndRate, MedicationStatement } from "@medplum/fhirtypes";
import { BadRequestError } from "@metriport/shared";
import { encodeToHtml } from "@metriport/shared/common/html";
import {
  findResourceInBundle,
  isMedication,
  isMedicationStatement,
} from "../../../external/fhir/shared";
import { MedicationSection } from "../../cda-types/sections";
import {
  CdaValuePq,
  EntryObject,
  ObservationTableRow,
  SubstanceAdministationEntry,
} from "../../cda-types/shared-types";
import {
  buildCodeCe,
  buildCodeCeFromCoding,
  buildCodeCvFromCodeableConcept,
  buildInstanceIdentifier,
  buildTemplateIds,
  formatDateToCdaTimestamp,
  formatDateToHumanReadableFormat,
  getDisplaysFromCodeableConcepts,
  notOnFilePlaceholder,
  withNullFlavor,
  withoutNullFlavorObject,
} from "../commons";
import {
  extensionValue2014,
  loincCodeSystem,
  loincSystemName,
  NOT_SPECIFIED,
  oids,
  placeholderOrgOid,
  _xsiTypeAttribute,
} from "../constants";
import { createTableRowsAndEntries } from "../create-table-rows-and-entries";
import { initiateSectionTable } from "../table";
import { AugmentedMedicationStatement } from "./augmented-resources";

const medicationsSectionName = "medications";
const tableHeaders = [
  "Medication",
  "Code",
  "Code System",
  "Dosage",
  "Frequency",
  "Start Date",
  "End Date",
  "Reason",
];

export function buildMedications(fhirBundle: Bundle): MedicationSection {
  const medicationsSection: MedicationSection = {
    templateId: buildInstanceIdentifier({
      root: oids.medicationsSection,
    }),
    code: buildCodeCe({
      code: "10160-0",
      codeSystem: loincCodeSystem,
      codeSystemName: loincSystemName,
      displayName: "History of Medication use Narrative",
    }),
    title: "MEDICATIONS",
    text: notOnFilePlaceholder,
  };

  const medicationStatements: MedicationStatement[] =
    fhirBundle.entry?.flatMap(entry =>
      isMedicationStatement(entry.resource) ? [entry.resource] : []
    ) || [];

  if (medicationStatements.length === 0) {
    return {
      _nullFlavor: "NI",
      ...medicationsSection,
    };
  }

  const augmentedMedStatements = createAugmentedMedicationStatements(
    medicationStatements,
    fhirBundle
  );

  const { trs, entries } = createTableRowsAndEntries(
    augmentedMedStatements,
    createTableRowsFromMedicationStatement,
    createEntryFromStatement
  );

  const table = initiateSectionTable(medicationsSectionName, tableHeaders, trs);

  medicationsSection.text = table;
  medicationsSection.entry = entries;

  return medicationsSection;
}

function createTableRowsFromMedicationStatement(
  statement: AugmentedMedicationStatement,
  referenceId: string
): ObservationTableRow[] {
  const period = {
    start: statement.resource?.effectivePeriod?.start,
    end: statement?.resource?.effectivePeriod?.end,
  };
  const code = buildCodeCeFromCoding(statement.medication?.code?.coding);
  const medicationName = statement.medication?.code?.text ?? code?._displayName;
  return [
    {
      tr: {
        _ID: referenceId,
        ["td"]: [
          {
            "#text": encodeToHtml(medicationName ?? NOT_SPECIFIED),
          },
          {
            "#text": code?._code ?? NOT_SPECIFIED,
          },
          {
            "#text": code?._codeSystem ?? NOT_SPECIFIED,
          },
          {
            "#text": getDosageFromMedicationStatement(statement.resource),
          },
          {
            "#text": getFrequencyFromMedicationStatement(statement.resource),
          },
          {
            "#text": formatDateToHumanReadableFormat(period.start) ?? NOT_SPECIFIED,
          },
          {
            "#text": formatDateToHumanReadableFormat(period.end) ?? NOT_SPECIFIED,
          },
          {
            "#text":
              getDisplaysFromCodeableConcepts(statement.resource.reasonCode) ?? NOT_SPECIFIED,
          },
        ],
      },
    },
  ];
}

function createAugmentedMedicationStatements(
  medicationStatements: MedicationStatement[],
  fhirBundle: Bundle
): AugmentedMedicationStatement[] {
  return medicationStatements.map(statement => {
    const ref = statement.medicationReference?.reference;
    const refResource = ref ? findResourceInBundle(fhirBundle, ref) : undefined;
    const medication = isMedication(refResource) ? refResource : undefined;
    if (!medication) {
      throw new BadRequestError("MedicationStatement must reference an existing Medication");
    }
    return new AugmentedMedicationStatement(medicationsSectionName, statement, medication);
  });
}

function getDosageFromMedicationStatement(statement: MedicationStatement): string {
  return statement.dosage?.flatMap(convertDosage).join(", ") || NOT_SPECIFIED;
}

function convertDosage(dosage: Dosage): string[] {
  return dosage.doseAndRate?.map(convertDoseAndRate).filter(Boolean) as string[];
}

function convertDoseAndRate(doseAndRate: DosageDoseAndRate): string | undefined {
  if (doseAndRate.doseQuantity?.value && doseAndRate.doseQuantity?.unit) {
    return `${doseAndRate.doseQuantity.value} ${doseAndRate.doseQuantity.unit}`;
  }
  return undefined;
}

function getFrequencyFromMedicationStatement(statement: MedicationStatement): string {
  return (
    statement.dosage
      ?.map(dosage => {
        const frequency = extractFrequency(dosage);
        return frequency?.map(pair => {
          return pair._value && pair._unit ? `${pair._value} ${pair._unit}` : undefined;
        });
      })
      .join(", ") || NOT_SPECIFIED
  );
}

function extractFrequency(dosage: Dosage | undefined): CdaValuePq[] | undefined {
  return dosage?.doseAndRate?.flatMap(doseAndRate => {
    if (doseAndRate.rateQuantity?.value && doseAndRate.rateQuantity?.unit) {
      return { _value: doseAndRate.rateQuantity.value, _unit: doseAndRate.rateQuantity.unit };
    }
    return [];
  });
}

function createEntryFromStatement(
  statement: AugmentedMedicationStatement,
  referenceId: string
): SubstanceAdministationEntry {
  const manufacturedMaterialCode = buildCodeCvFromCodeableConcept(
    statement.medication?.code,
    referenceId
  );
  return {
    substanceAdministration: {
      _classCode: "SBADM",
      _moodCode: "INT",
      templateId: buildTemplateIds({
        root: statement.typeOid,
        extension: extensionValue2014,
      }),
      id: buildInstanceIdentifier({
        root: placeholderOrgOid,
        extension: statement.resource.id,
      }),
      statusCode: {
        _code: statement.resource.status,
      },
      effectiveTime: {
        [_xsiTypeAttribute]: "IVL_TS",
        low: withoutNullFlavorObject(
          formatDateToCdaTimestamp(statement.resource.effectivePeriod?.start),
          "_value"
        ),
        high: withoutNullFlavorObject(
          formatDateToCdaTimestamp(statement.resource.effectivePeriod?.end),
          "_value"
        ),
      },
      doseQuantity: buildDoseQuantity(statement.resource.dosage),
      consumable: {
        _typeCode: "CSM",
        manufacturedProduct: {
          _classCode: "MANU",
          templateId: buildTemplateIds({
            root: oids.medicationInformation,
            extension: extensionValue2014,
          }),
          manufacturedMaterial: {
            code: manufacturedMaterialCode,
          },
        },
      },
    },
  };
}

function buildDoseQuantity(dosages: Dosage[] | undefined): EntryObject | CdaValuePq {
  if (!dosages) return withNullFlavor(undefined, "_value");

  for (const dosage of dosages) {
    const frequencies = extractFrequency(dosage);
    if (frequencies) {
      for (const freq of frequencies) {
        if (freq._value && freq._unit) {
          return {
            _value: freq._value,
            _unit: freq._unit,
          };
        }
      }
    }
  }
  return withNullFlavor(undefined, "_value");
}
