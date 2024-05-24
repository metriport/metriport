import {
  Bundle,
  CodeableConcept,
  Dosage,
  DosageDoseAndRate,
  MedicationStatement,
} from "@medplum/fhirtypes";
import {
  findResourceInBundle,
  isMedication,
  isMedicationStatement,
} from "../../../external/fhir/shared";
import BadRequestError from "../../../util/error/bad-request";
import { MedicationSection } from "../../cda-types/sections";
import {
  CdaCodeCe,
  ObservationTableRow,
  SubstanceAdministationEntry,
} from "../../cda-types/shared-types";
import {
  buildCodeCe,
  buildCodeCeFromCoding,
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
  oids,
  placeholderOrgOid,
} from "../constants";
import { createTableRowsAndEntries } from "../create-table-rows-and-entries";
import { AugmentedMedicationStatement } from "./augmented-resources";

const medicationsSectionName = "medications";
const tableHeaders = [
  "Medication",
  "Code",
  "Dosage",
  "Frequency",
  "Start Date",
  "End Date",
  "Reason",
];

export function buildMedications(fhirBundle: Bundle): MedicationSection {
  const medicationStatements: MedicationStatement[] =
    fhirBundle.entry?.flatMap(entry =>
      isMedicationStatement(entry.resource) ? [entry.resource] : []
    ) || [];

  if (medicationStatements.length === 0) {
    return undefined;
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

  const medicationsSection = {
    section: {
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
      text: table,
      entry: entries,
    },
  };
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
  const medicationCode = buildMedicationCode(code);
  return [
    {
      tr: {
        [_idAttribute]: referenceId,
        ["td"]: [
          {
            [_inlineTextAttribute]: medicationName,
          },
          {
            [_inlineTextAttribute]: medicationCode, // TODO: Improve this to show the human readable system name alongside the system
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
            [_inlineTextAttribute]: getPrescriptionReasons(statement.resource.reasonCode),
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
        return dosage.doseAndRate
          ?.map(doseAndRate => {
            if (doseAndRate.rateQuantity?.value && doseAndRate.rateQuantity?.unit) {
              return `${doseAndRate.rateQuantity.value} ${doseAndRate.rateQuantity.unit}`;
            }
            return undefined;
          })
          .filter(Boolean);
      })
      .flat()
      .join(", ") || NOT_SPECIFIED
  );
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

function buildMedicationCode(code: CdaCodeCe | undefined): string {
  if (code?._code) {
    if (code._codeSystem) return `${code._code} - ${code._codeSystem}`;
    if (code._codeSystemName) return `${code._code} - ${code._codeSystemName}`;
  }
  return NOT_SPECIFIED;
}

function getPrescriptionReasons(concepts: CodeableConcept[] | undefined): string {
  if (!concepts) return NOT_SPECIFIED;
  if (concepts.length > 0) {
    return concepts
      .map(concept => {
        const code = buildCodeCeFromCoding(concept.coding);
        if (code?._displayName) return code._displayName.trim();
        if (concept.text) return concept.text.trim();
        return;
      })
      .join(", ");
  }
  return NOT_SPECIFIED;
}
