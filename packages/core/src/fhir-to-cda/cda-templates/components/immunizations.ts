import { Bundle, Immunization, Location } from "@medplum/fhirtypes";
import { findResourceInBundle, isImmunization, isLocation } from "../../../external/fhir/shared";
import { ConcernActEntry, ObservationTableRow } from "../../cda-types/shared-types";
import {
  buildCodeCe,
  buildInstanceIdentifier,
  buildValueCd,
  formatDateToHumanReadableFormat,
  getDisplaysFromCodeableConcepts,
} from "../commons";
import { NOT_SPECIFIED, loincCodeSystem, loincSystemName, oids } from "../constants";
import { createTableRowsAndEntries } from "../create-table-rows-and-entries";
import { initiateSectionTable } from "../table";
import { AugmentedImmunization } from "./augmented-resources";

export const encountersSectionName = "immunizations";

const tableHeaders = ["Immunization", "Status", "Location", "Date"];

export function buildImmunizations(fhirBundle: Bundle) {
  const immunizations: Immunization[] =
    fhirBundle.entry?.flatMap(entry => (isImmunization(entry.resource) ? [entry.resource] : [])) ||
    [];

  if (immunizations.length === 0) {
    return undefined;
  }

  const augmentedImmunizations = createAugmentedImmunizations(immunizations, fhirBundle);

  const { trs, entries } = createTableRowsAndEntries(
    augmentedImmunizations,
    createTableRowFromImmunization,
    createEntryFromEncounter
  );

  const table = initiateSectionTable(encountersSectionName, tableHeaders, trs);

  return {
    templateId: buildInstanceIdentifier({
      root: oids.immunizationsSection,
    }),
    code: buildCodeCe({
      code: "11369-6",
      codeSystem: loincCodeSystem,
      codeSystemName: loincSystemName,
      displayName: "History of immunizations",
    }),
    title: "IMMUNIZATIONS",
    text: table,
    entry: entries,
  };
}

function createAugmentedImmunizations(
  immunizations: Immunization[],
  fhirBundle: Bundle
): AugmentedImmunization[] {
  return immunizations.map(immunization => {
    const locationName = immunization.location?.display;
    if (locationName) {
      return new AugmentedImmunization(
        encountersSectionName,
        immunization,
        undefined,
        locationName
      );
    }

    const locationId = immunization.location?.reference;
    if (locationId) {
      const location = findResourceInBundle(fhirBundle, locationId);
      if (isLocation(location)) {
        return new AugmentedImmunization(encountersSectionName, immunization, location);
      }
    }

    return new AugmentedImmunization(encountersSectionName, immunization);
  });
}

function createTableRowFromImmunization(
  immunization: AugmentedImmunization,
  referenceId: string
): ObservationTableRow[] {
  const locationInfo = immunization.location && getLocationInformation(immunization.location);

  return [
    {
      tr: {
        _ID: referenceId,
        ["td"]: [
          {
            "#text": immunization.resource.vaccineCode
              ? getDisplaysFromCodeableConcepts([immunization.resource.vaccineCode])
              : NOT_SPECIFIED,
          },
          {
            "#text": mapImmunizationStatus(immunization.resource.status) ?? NOT_SPECIFIED,
          },
          {
            "#text": locationInfo ?? immunization.locationName ?? NOT_SPECIFIED,
          },
          {
            "#text":
              formatDateToHumanReadableFormat(immunization.resource.occurrenceDateTime) ??
              NOT_SPECIFIED,
          },
        ],
      },
    },
  ];
}

function getLocationInformation(location: Location | undefined): string | undefined {
  if (!location) return undefined;
  return `${location.name} - ${location.address}`;
}

function mapImmunizationStatus(status: string | undefined): string | undefined {
  if (!status) return undefined;
  switch (status) {
    case "completed":
      return "completed";
    case "entered-in-error":
      return "nullified";
    case "not-done":
      return "new";
    default:
      return "completed";
  }
}

function createEntryFromEncounter(immunization: AugmentedImmunization, referenceId: string) {
  console.log(immunization, referenceId);
  // return {
  //   encounter: {
  //     _classCode: "ENC",
  //     _moodCode: "EVN",
  //     templateId: buildInstanceIdentifier({
  //       root: encounter.typeOid,
  //       extension: extensionValue2015,
  //     }),
  //     id: buildInstanceIdentifier({
  //       root: placeholderOrgOid,
  //       extension: encounter.resource.id,
  //     }),
  //     code: buildCodeCeFromCoding(encounter.resource.type),
  //     statusCode: {
  //       _code: mapEncounterStatusCode(encounter.resource.status),
  //     },
  //     effectiveTime: {
  //       low: withoutNullFlavorObject(
  //         formatDateToCdaTimestamp(encounter.resource.period?.start),
  //         "_value"
  //       ),
  //       high: withoutNullFlavorObject(
  //         formatDateToCdaTimestamp(encounter.resource.period?.end),
  //         "_value"
  //       ),
  //     },
  //     performer: createPerformer(encounter.practitioners),
  //     entryRelationship: createEntryRelationshipObservation(encounter.resource, referenceId),
  //   },
  // };
}

export function createEntryRelationshipObservation(
  encounter: Immunization,
  referenceId: string
): ConcernActEntry {
  return {
    _typeCode: "RSON",
    act: {
      _classCode: "ACT",
      _moodCode: "EVN",
      templateId: buildInstanceIdentifier({
        root: oids.encounterDiagnosis,
      }),
      code: buildCodeCe({
        code: "29308-4",
        codeSystem: loincCodeSystem,
        codeSystemName: loincSystemName,
        displayName: "Encounter Diagnosis",
      }),
      entryRelationship: {
        _inversionInd: false,
        _typeCode: "SUBJ",
        observation: {
          _classCode: "OBS",
          _moodCode: "EVN",
          code: {
            ...buildCodeCe({
              code: "282291009",
              codeSystem: "2.16.840.1.113883.3.88.12.3221.7.2",
              codeSystemName: "SNOMED CT",
              displayName: "Diagnosis",
            }),
            translation: [
              buildCodeCe({
                code: "29308-4",
                codeSystem: loincCodeSystem,
                codeSystemName: loincSystemName,
                displayName: "Diagnosis",
              }),
            ],
          },
          value: encounter.reasonCode?.flatMap(reason => buildValueCd(reason, referenceId) || []),
        },
      },
    },
  };
}
