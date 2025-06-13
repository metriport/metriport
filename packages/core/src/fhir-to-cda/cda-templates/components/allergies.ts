import {
  AllergyIntolerance,
  AllergyIntoleranceReaction,
  Bundle,
  CodeableConcept,
  Coding,
} from "@medplum/fhirtypes";
import { encodeToHtml } from "@metriport/shared/common/html";
import { isAllergyIntolerance } from "../../../external/fhir/shared";
import { AllergiesSection } from "../../cda-types/sections";
import {
  ActStatusCode,
  CdaValueCd,
  ConcernActEntry,
  ObservationEntryRelationship,
  ObservationTableRow,
  Participant,
} from "../../cda-types/shared-types";
import {
  buildCodeCe,
  buildCodeCvFromCodeableConcept,
  buildInstanceIdentifier,
  buildOriginalTextReference,
  buildTemplateIds,
  buildValueCd,
  formatDateToCdaTimestamp,
  formatDateToHumanReadableFormat,
  getTextFromCode,
  notOnFilePlaceholder,
  withNullFlavor,
} from "../commons";
import {
  extensionValue2014,
  extensionValue2015,
  hl7ActCode,
  loincCodeSystem,
  loincSystemName,
  NOT_SPECIFIED,
  oids,
  placeholderOrgOid,
  snomedCodeSystem,
  snomedSystemName,
  _xsiTypeAttribute,
} from "../constants";
import { createTableRowsAndEntries } from "../create-table-rows-and-entries";
import { initiateSectionTable } from "../table";
import { AugmentedAllergy } from "./augmented-resources";

type AllergyType = "food" | "medication" | "environment" | "biologic";

export const allergiesSectionName = "allergies";
const tableHeaders = [
  "Substance",
  "Category",
  "Reaction",
  "Date of Occurrence",
  "Date of First Onset",
  "Comments",
];

export function buildAllergies(fhirBundle: Bundle): AllergiesSection {
  const allergiesSection: AllergiesSection = {
    templateId: buildTemplateIds({
      root: oids.allergiesSection,
      extension: extensionValue2014,
    }),
    code: buildCodeCe({
      code: "48765-2",
      codeSystem: loincCodeSystem,
      codeSystemName: loincSystemName,
      displayName: "Allergies and Adverse Reactions",
    }),
    title: "ALLERGIES, ADVERSE REACTIONS, ALERTS",
    text: notOnFilePlaceholder,
  };

  const allergies: AllergyIntolerance[] =
    fhirBundle.entry?.flatMap(entry =>
      isAllergyIntolerance(entry.resource) ? [entry.resource] : []
    ) || [];

  if (allergies.length === 0) {
    return {
      _nullFlavor: "NI",
      ...allergiesSection,
    };
  }

  const augmentedAllergies = allergies.map(allergy => {
    return new AugmentedAllergy(allergiesSectionName, allergy);
  });

  const { trs, entries } = createTableRowsAndEntries(
    augmentedAllergies,
    createTableRowsFromAllergyIntolerance,
    createEntryFromAllergy
  );

  const table = initiateSectionTable(allergiesSectionName, tableHeaders, trs);

  allergiesSection.text = table;
  allergiesSection.entry = entries;

  return allergiesSection;
}

function createTableRowsFromAllergyIntolerance(
  allergy: AugmentedAllergy,
  referenceId: string
): ObservationTableRow | ObservationTableRow[] {
  const onsetDate = formatDateToHumanReadableFormat(allergy.resource.onsetDateTime);
  const category = allergy.resource.category;
  const allergenName = allergy.resource.reaction
    ?.flatMap(reaction => {
      return (
        reaction.substance?.coding
          ?.flatMap(coding => {
            return coding.display || [];
          })
          .join(", ") || []
      );
    })
    .join(", ");
  const name = getTextFromCode(allergy.resource.code);
  const note = allergy.resource.note?.[0]?.text;
  if (!allergy.resource.reaction) {
    return createTableRowFromAllergyIntolerance(
      undefined,
      allergenName,
      name,
      category,
      onsetDate,
      note,
      createReactionReference(referenceId)
    );
  }
  return allergy.resource.reaction?.flatMap(
    (reaction, index) =>
      createTableRowFromAllergyIntolerance(
        reaction,
        allergenName,
        name,
        category,
        onsetDate,
        note,
        createReactionReference(referenceId, index)
      ) || []
  );
}

function createReactionReference(ref: string, index = 0): string {
  return `${ref}-reaction${index + 1}`;
}

function createTableRowFromAllergyIntolerance(
  reaction: AllergyIntoleranceReaction | undefined,
  allergenName: string | undefined,
  name: string | undefined,
  category: string[] | undefined,
  onsetDate: string | undefined,
  note: string | undefined,
  referenceId: string
) {
  const manifestation = getTextFromCode(reaction?.manifestation?.[0]);
  return [
    {
      tr: {
        _ID: referenceId,
        ["td"]: [
          {
            _ID: `${referenceId}-substance`,
            "#text": encodeToHtml(allergenName ?? name ?? NOT_SPECIFIED),
          },
          {
            "#text": category?.join(", ") ?? NOT_SPECIFIED,
          },
          {
            _ID: `${referenceId}-manifestation`,
            "#text": manifestation,
          },
          {
            "#text": formatDateToHumanReadableFormat(reaction?.onset) ?? NOT_SPECIFIED,
          },
          {
            "#text": onsetDate ?? NOT_SPECIFIED,
          },
          {
            "#text": encodeToHtml(note ?? NOT_SPECIFIED),
          },
        ],
      },
    },
  ];
}

function createEntryFromAllergy(allergy: AugmentedAllergy, referenceId: string): ConcernActEntry {
  const statusCode = mapAllergyStatusCode(allergy.resource.clinicalStatus?.coding);
  const resolutionDate = getResolutionDate(statusCode, allergy.resource.lastOccurrence);
  const reactionReference = `#${createReactionReference(referenceId, 0)}`;
  return {
    _typeCode: "DRIV",
    _contextConductionInd: true,
    act: {
      _moodCode: "EVN",
      _classCode: "ACT",
      templateId: buildTemplateIds({
        root: allergy.typeOid,
        extension: extensionValue2015,
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
      text: {
        reference: {
          _value: reactionReference,
        },
      },
      statusCode: {
        _code: statusCode ?? "active",
      },
      effectiveTime: {
        low: withNullFlavor(formatDateToCdaTimestamp(allergy.resource.recordedDate), "_value"),
        ...(resolutionDate && {
          high: resolutionDate,
        }),
      },
      entryRelationship: createEntryRelationship(allergy.resource, referenceId, reactionReference),
    },
  };
}

function getResolutionDate(
  statusCode: ActStatusCode | undefined,
  lastOccurrence: string | undefined
) {
  if (statusCode === "completed") {
    return withNullFlavor(formatDateToCdaTimestamp(lastOccurrence), "_value");
  }
  return undefined;
}

function createEntryRelationship(
  allergy: AllergyIntolerance,
  referenceId: string,
  reactionReferenceId: string
): ObservationEntryRelationship {
  return {
    _typeCode: "SUBJ",
    _contextConductionInd: true,
    observation: {
      _classCode: "OBS",
      _moodCode: "EVN",
      templateId: buildTemplateIds({
        root: oids.allergyIntoleranceObservation,
        extension: extensionValue2014,
      }),
      id: buildInstanceIdentifier({
        root: placeholderOrgOid,
        extension: allergy.id,
      }),
      code: buildCodeCe({
        code: "ASSERTION",
        codeSystem: hl7ActCode,
        codeSystemName: "HL7 ActCode",
        displayName: "Assertion",
      }),
      statusCode: {
        _code: "completed",
      },
      effectiveTime: {
        low: withNullFlavor(formatDateToCdaTimestamp(allergy.onsetDateTime), "_value"),
      },
      value: buildAllergyTypeValue(allergy.category?.[0], reactionReferenceId),
      participant: createParticipant(allergy.code, reactionReferenceId),
      entryRelationship: createReactionEntryRelationship(allergy.reaction, referenceId),
    },
  };
}

function buildAllergyTypeValue(category: AllergyType | undefined, referenceId: string): CdaValueCd {
  const valueCd: CdaValueCd = {
    [_xsiTypeAttribute]: "CD",
    _codeSystem: snomedCodeSystem,
    _codeSystemName: snomedSystemName,
    originalText: buildOriginalTextReference(referenceId),
  };
  switch (category) {
    case "medication":
      return {
        ...valueCd,
        _code: "416098002",
        _displayName: "Drug allergy",
      };
    case "food":
      return {
        ...valueCd,
        _code: "414285001",
        _displayName: "Allergy to food",
      };
    case "environment":
      return {
        ...valueCd,
        _code: "426232007",
        _displayName: "Environmental allergy",
      };
    default:
      return {
        ...valueCd,
        _code: "419199007",
        _displayName: "Allergy to substance",
      };
  }
}

function createParticipant(
  concept: CodeableConcept | undefined,
  referenceId: string
): Participant | undefined {
  if (!concept) return undefined;
  return {
    _typeCode: "CSM",
    _contextControlCode: "OP",
    participantRole: {
      _classCode: "MANU",
      playingEntity: {
        _classCode: "MMAT",
        code: buildCodeCvFromCodeableConcept(concept, `${referenceId}-substance`),
      },
    },
  };
}

function createReactionEntryRelationship(
  reactions: AllergyIntoleranceReaction[] | undefined,
  referenceId: string
): ObservationEntryRelationship[] | undefined {
  return reactions?.map((reaction, index) => {
    return {
      _typeCode: "MFST",
      _inversionInd: true,
      observation: {
        _classCode: "OBS",
        _moodCode: "EVN",
        templateId: buildTemplateIds({
          root: oids.reactionObservation,
          extension: extensionValue2014,
        }),
        id: { _nullFlavor: "NI" },
        code: buildCodeCe({
          code: "ASSERTION",
          codeSystem: hl7ActCode,
          codeSystemName: "HL7 ActCode",
          displayName: "Assertion",
        }),
        text: {
          reference: {
            _value: `${createReactionReference(referenceId, index)}-substance`,
          },
        },
        statusCode: {
          _code: "completed",
        },
        value: buildValueCd(
          reaction.manifestation?.[0],
          `${createReactionReference(referenceId, index)}-manifestation`
        ),
      },
    };
  });
}

/**
 * For FHIR statuses:
 * @see https://hl7.org/fhir/R4/valueset-allergyintolerance-clinical.html
 * For CDA statuses:
 * @see https://terminology.hl7.org/5.2.0/ValueSet-v3-ActStatus.html
 */
function mapAllergyStatusCode(coding: Coding[] | undefined): ActStatusCode | undefined {
  if (!coding) return undefined;
  for (const c of coding) {
    if (c.code) {
      switch (c.code) {
        case "active":
          return "active";
        case "inactive":
          return "suspended";
        case "resolved":
          return "completed";
      }
    }
  }
  return undefined;
}
