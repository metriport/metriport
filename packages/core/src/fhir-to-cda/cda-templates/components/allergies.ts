import { AllergyIntolerance, AllergyIntoleranceReaction, Bundle, Coding } from "@medplum/fhirtypes";
import { isAllergyIntolerance } from "../../../external/fhir/shared";
import { AllergiesSection } from "../../cda-types/sections";
import {
  ConcernActEntry,
  ObservationEntryRelationship,
  ObservationTableRow,
  Participant,
} from "../../cda-types/shared-types";
import {
  buildCodeCe,
  buildCodeCvFromCodeableConcept,
  buildInstanceIdentifier,
  buildValueCd,
  formatDateToCdaTimestamp,
  formatDateToHumanReadableFormat,
  getTextFromCode,
  isLoinc,
  withoutNullFlavorObject,
} from "../commons";
import {
  NOT_SPECIFIED,
  extensionValue2014,
  extensionValue2015,
  loincCodeSystem,
  loincSystemName,
  oids,
  placeholderOrgOid,
} from "../constants";
import { createTableRowsAndEntries } from "../create-table-rows-and-entries";
import { initiateSectionTable } from "../table";
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

export function buildAllergies(fhirBundle: Bundle): AllergiesSection {
  const allergies: AllergyIntolerance[] =
    fhirBundle.entry?.flatMap(entry =>
      isAllergyIntolerance(entry.resource) ? [entry.resource] : []
    ) || [];

  if (allergies.length === 0) {
    return undefined;
  }

  const augmentedAllergies = allergies.map(allergy => {
    return new AugmentedAllergy(allergiesSectionName, allergy);
  });

  const { trs, entries } = createTableRowsAndEntries(
    augmentedAllergies,
    createTableRowFromAllergyIntolerance,
    createEntryFromAllergy
  );

  const table = initiateSectionTable(allergiesSectionName, tableHeaders, trs);

  const allergySection = {
    templateId: buildInstanceIdentifier({
      root: oids.allergiesSection,
      extension: extensionValue2015,
    }),
    code: buildCodeCe({
      code: "48765-2",
      codeSystem: loincCodeSystem,
      codeSystemName: loincSystemName,
      displayName: "Allergies and Adverse Reactions",
    }),
    title: "ALLERGIES, ADVERSE REACTIONS, ALERTS",
    text: table,
    entry: entries,
  };
  return allergySection;
}

function createTableRowFromAllergyIntolerance(
  allergy: AugmentedAllergy,
  referenceId: string
): ObservationTableRow[] {
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
  const manifestation = getTextFromCode(allergy.resource.reaction?.[0]?.manifestation?.[0]);
  return [
    {
      tr: {
        _ID: referenceId,
        ["td"]: [
          {
            _ID: `${referenceId}-substance`,
            "#text": allergenName ?? name,
          },
          {
            "#text": allergy.resource.category?.join(", ") ?? NOT_SPECIFIED,
          },
          {
            _ID: `${referenceId}-reaction`,
            "#text": manifestation,
          },
          {
            "#text":
              formatDateToHumanReadableFormat(allergy.resource.reaction?.[0]?.onset) ??
              NOT_SPECIFIED,
          },
          {
            "#text":
              formatDateToHumanReadableFormat(allergy.resource.onsetDateTime) ?? NOT_SPECIFIED,
          },
          {
            "#text": allergy.resource.note?.[0]?.text ?? NOT_SPECIFIED,
          },
        ],
      },
    },
  ];
}

function createEntryFromAllergy(allergy: AugmentedAllergy, referenceId: string): ConcernActEntry {
  return {
    act: {
      _classCode: "ACT",
      _moodCode: "EVN",
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
        _code: mapAllergyStatusCode(allergy.resource.clinicalStatus?.coding) ?? "active",
      },
      effectiveTime: {
        low: withoutNullFlavorObject(
          formatDateToCdaTimestamp(allergy.resource.recordedDate),
          "_value"
        ),
      },
      entryRelationship: createEntryRelationship(allergy.resource, referenceId),
    },
  };
}

function createEntryRelationship(
  allergy: AllergyIntolerance,
  referenceId: string
): ObservationEntryRelationship {
  const codeSystem = allergy.code?.coding?.[0]?.system;
  const systemIsLoinc = isLoinc(codeSystem);
  return {
    _typeCode: "SUBJ",
    observation: {
      _classCode: "OBS",
      _moodCode: "EVN",
      templateId: buildInstanceIdentifier({
        root: oids.allergyIntoleranceObservation,
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
      // <participant typeCode="CSM" contextControlCode="OP">
      //   <participantRole classCode="MANU">
      //     <playingEntity classCode="MMAT">
      //       <code code="372665008" codeSystem="2.16.840.1.113883.6.96" codeSystemName="SNOMED CT" displayName="Non-steroidal anti-inflammatory agent (substance)">
      //         <originalText>
      //           <reference value="#ALLERGEN61746603" />
      //         </originalText>
      //         <translation code="385" codeSystem="2.16.840.1.113883.6.313" codeSystemName="MUL.ALGCAT" displayName="NSAIDs" />
      //       </code>
      //     </playingEntity>
      //   </participantRole>
      // </participant>
      participant: createParticipant(allergy.reaction?.[0], referenceId),
      entryRelationship: [createReactionEntryRelationship(allergy, referenceId)],
    },
  };
}

function createParticipant(
  reaction: AllergyIntoleranceReaction | undefined,
  referenceId: string
): Participant | undefined {
  if (!reaction) return undefined;
  return {
    _typeCode: "CSM",
    _contextControlCode: "OP",
    participantRole: {
      _classCode: "MANU",
      playingEntity: {
        _classCode: "MMAT",
        code: buildCodeCvFromCodeableConcept(reaction.substance, `${referenceId}-substance`),
      },
    },
  };
}
function createReactionEntryRelationship(
  allergy: AllergyIntolerance,
  referenceId: string
): ObservationEntryRelationship {
  const codeSystem = allergy.code?.coding?.[0]?.system;
  const systemIsLoinc = isLoinc(codeSystem);
  return {
    _typeCode: "MFST",
    _inversionInd: true,
    observation: {
      _classCode: "OBS",
      _moodCode: "EVN",
      templateId: buildInstanceIdentifier({
        root: oids.reactionObservation,
        extension: extensionValue2014,
      }),
      id: { _nullFlavor: "NI" },
      code: buildCodeCe({
        code: allergy.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.code,
        codeSystem: systemIsLoinc ? loincCodeSystem : codeSystem,
        codeSystemName: systemIsLoinc ? loincSystemName : undefined,
        displayName: allergy.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display,
      }),
      text: {
        reference: {
          _value: `${referenceId}-reaction`,
        },
      },
      value: buildValueCd(allergy.code, `${referenceId}-reaction`),
    },
  };
}

/**
 * For FHIR statuses:
 * @see https://hl7.org/fhir/R4/valueset-allergyintolerance-clinical.html
 * For CDA statuses:
 * @see https://terminology.hl7.org/5.2.0/ValueSet-v3-ActStatus.html
 */
function mapAllergyStatusCode(coding: Coding[] | undefined): string | undefined {
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
