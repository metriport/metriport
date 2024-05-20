import { AllergyIntolerance, Bundle } from "@medplum/fhirtypes";
import { ObservationTableRow } from "../../cda-types/shared-types";
import { isAllergyIntolerance } from "../../fhir";
import {
  buildCodeCe,
  buildInstanceIdentifier,
  buildValueCd,
  formatDateToCdaTimestamp,
  formatDateToHumanReadableFormat,
  getTextFromCode,
  initiateSectionTable,
  isLoinc,
  withoutNullFlavorObject,
} from "../commons";
import {
  NOT_SPECIFIED,
  _classCodeAttribute,
  _codeAttribute,
  _idAttribute,
  _inlineTextAttribute,
  _moodCodeAttribute,
  _nullFlavorAttribute,
  _typeCodeAttribute,
  _valueAttribute,
  extensionValue2014,
  extensionValue2015,
  loincCodeSystem,
  loincSystemName,
  placeholderOrgOid,
} from "../constants";
import { createTableRowsAndEntries } from "../create-table-rows-and-entries";
import { AugmentedAllergy } from "./augmented-resources";

export const allergiesSectionName = "allergies";
const tableHeaders = [
  "Substance",
  "Category",
  "Reaction",
  "Date of Occurrence",
  "Date of First Onset",
  "Comments",
];

export function buildAllergies(fhirBundle: Bundle) {
  const allergies: AllergyIntolerance[] =
    fhirBundle.entry?.flatMap(entry =>
      isAllergyIntolerance(entry.resource) ? [entry.resource] : []
    ) || [];

  if (allergies.length === 0) {
    return undefined;
  }

  const augmentedAllergies = allergies.map(allergy => {
    return new AugmentedAllergy(allergy, allergiesSectionName);
  });

  const { trs, entries } = createTableRowsAndEntries(
    augmentedAllergies,
    createTableRowFromAllergyIntolerance,
    createEntryFromAllergy
  );

  const table = initiateSectionTable(allergiesSectionName, tableHeaders, trs);

  const allergySection = {
    component: {
      section: {
        templateId: buildInstanceIdentifier({
          root: "2.16.840.1.113883.10.20.22.2.6.1",
          extension: extensionValue2015,
        }),
        code: buildCodeCe({
          code: "48765-2",
          codeSystem: loincCodeSystem,
          codeSystemName: loincSystemName,
          displayName: "Allergies and Adverse Reactions",
        }),
        title: "ALLERGIES, ADVERSE REACTIONS, ALERTS",
        text: { table },
        entry: entries,
      },
    },
  };
  return allergySection;
}

function createTableRowFromAllergyIntolerance(
  allergy: AugmentedAllergy,
  referenceId: string
): ObservationTableRow[] {
  const name = getTextFromCode(allergy.resource.code);
  const manifestation = getTextFromCode(allergy.resource.reaction?.[0]?.manifestation?.[0]);

  return [
    {
      tr: {
        [_idAttribute]: referenceId,
        ["td"]: [
          {
            [_inlineTextAttribute]: allergy.resource.reaction?.[0]?.substance?.text ?? name,
          },
          {
            [_inlineTextAttribute]: allergy.resource.category?.[0] ?? NOT_SPECIFIED,
          },
          {
            [_inlineTextAttribute]: manifestation,
          },
          {
            [_idAttribute]: `${referenceId}-reaction`,
            [_inlineTextAttribute]:
              formatDateToHumanReadableFormat(allergy.resource.reaction?.[0]?.onset) ??
              NOT_SPECIFIED,
          },
          {
            [_inlineTextAttribute]:
              formatDateToHumanReadableFormat(allergy.resource.onsetDateTime) ?? NOT_SPECIFIED,
          },
          {
            [_inlineTextAttribute]: allergy.resource.note?.[0]?.text ?? NOT_SPECIFIED,
          },
        ],
      },
    },
  ];
}

function createEntryFromAllergy(allergy: AugmentedAllergy, referenceId: string) {
  return [
    {
      act: {
        [_classCodeAttribute]: "ACT",
        [_moodCodeAttribute]: "EVN",
        templateId: buildInstanceIdentifier({
          root: allergy.typeOid,
          extension: extensionValue2014,
        }),
        id: buildInstanceIdentifier({
          root: placeholderOrgOid,
          extension: allergy.resource.id,
        }),
        code: buildCodeCe({
          code: "CONC",
          codeSystem: "2.16.840.1.113883.5.6",
          displayName: "Concern",
        }),
        statusCode: {
          [_codeAttribute]: allergy.resource.clinicalStatus?.coding?.[0]?.code ?? "active", // TODO: Check if this is the correct approach
        },
        effectiveTime: {
          low: withoutNullFlavorObject(
            formatDateToCdaTimestamp(allergy.resource.recordedDate),
            _valueAttribute
          ),
        },
        entryRelationship: createEntryRelationship(allergy.resource, referenceId),
      },
    },
  ];
}

function createEntryRelationship(allergy: AllergyIntolerance, referenceId: string) {
  const codeSystem = allergy.code?.coding?.[0]?.system;
  const systemIsLoinc = isLoinc(codeSystem);
  return {
    [_typeCodeAttribute]: "SUBJ",
    observation: {
      [_classCodeAttribute]: "OBS",
      [_moodCodeAttribute]: "EVN",
      templateId: buildInstanceIdentifier({
        root: "2.16.840.1.113883.10.20.22.4.7",
        extension: extensionValue2014,
      }),
      id: buildInstanceIdentifier({
        root: placeholderOrgOid,
        extension: allergy.id,
      }),
      code: buildCodeCe({
        code: allergy.code?.coding?.[0]?.code,
        codeSystem: systemIsLoinc ? loincCodeSystem : codeSystem,
        codeSystemName: systemIsLoinc ? loincSystemName : undefined,
        displayName: allergy.code?.coding?.[0]?.display,
      }),
      value: buildValueCd(allergy.code, referenceId),
      entryRelationship: createReactionEntryRelationship(allergy, referenceId),
    },
  };
}

function createReactionEntryRelationship(allergy: AllergyIntolerance, referenceId: string) {
  const codeSystem = allergy.code?.coding?.[0]?.system;
  const systemIsLoinc = isLoinc(codeSystem);
  return {
    [_typeCodeAttribute]: "MFST",
    _inversionInd: true,
    observation: {
      [_classCodeAttribute]: "OBS",
      [_moodCodeAttribute]: "EVN",
      templateId: buildInstanceIdentifier({
        root: "2.16.840.1.113883.10.20.22.4.9",
        extension: extensionValue2014,
      }),
      id: { [_nullFlavorAttribute]: "NI" },
      code: buildCodeCe({
        code: allergy.code?.coding?.[0]?.code,
        codeSystem: systemIsLoinc ? loincCodeSystem : codeSystem,
        codeSystemName: systemIsLoinc ? loincSystemName : undefined,
        displayName: allergy.code?.coding?.[0]?.display,
      }),
      text: {
        reference: {
          [_valueAttribute]: `${referenceId}-reaction`,
        },
      },
      value: buildValueCd(allergy.code, `${referenceId}-reaction`),
    },
  };
}
