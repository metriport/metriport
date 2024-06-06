import { Bundle, Immunization, Location } from "@medplum/fhirtypes";
import { findResourceInBundle, isImmunization, isLocation } from "../../../external/fhir/shared";
import { CdaSimpleReference, ObservationTableRow } from "../../cda-types/shared-types";
import {
  buildAddressText,
  buildCodeCe,
  buildCodeCvFromCodeableConcept,
  buildInstanceIdentifier,
  buildPerformerFromLocation,
  formatDateToCdaTimestamp,
  formatDateToHumanReadableFormat,
  getDisplaysFromCodeableConcepts,
  withoutNullFlavorObject,
} from "../commons";
import {
  NOT_SPECIFIED,
  extensionValue2015,
  hl7actCode,
  loincCodeSystem,
  loincSystemName,
  oids,
  placeholderOrgOid,
} from "../constants";
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
    const locationId = immunization.location?.reference;
    const location = locationId ? findResourceInBundle(fhirBundle, locationId) : undefined;
    if (isLocation(location)) {
      return new AugmentedImmunization(encountersSectionName, immunization, location, locationName);
    }
    return new AugmentedImmunization(encountersSectionName, immunization, undefined, locationName);
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
            _ID: `${referenceId}-material`,
            "#text": immunization.resource.vaccineCode
              ? getDisplaysFromCodeableConcepts([immunization.resource.vaccineCode])
              : NOT_SPECIFIED,
          },
          {
            "#text": mapImmunizationStatusCode(immunization.resource.status) ?? NOT_SPECIFIED,
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
  return `${location.name} - ${buildAddressText(location.address)}`;
}

function mapImmunizationStatusCode(status: string | undefined): string | undefined {
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
  return {
    substanceAdministration: {
      _classCode: "SBADM",
      _moodCode: "EVN",
      _negationInd: "false",
      templateId: buildInstanceIdentifier({
        root: immunization.typeOid,
        extension: extensionValue2015,
      }),
      id: buildInstanceIdentifier({
        root: placeholderOrgOid,
        extension: immunization.resource.id,
      }),
      code: buildCodeCe({
        code: "IMMUNIZ",
        codeSystem: hl7actCode,
        codeSystemName: "ActCode",
      }),
      text: buildSimpleReference(referenceId),
      statusCode: {
        _code: mapImmunizationStatusCode(immunization.resource.status),
      },
      effectiveTime: withoutNullFlavorObject(
        formatDateToCdaTimestamp(immunization.resource.occurrenceDateTime),
        "_value"
      ),
      consumable: buildConsumable(immunization.resource, referenceId),
      performer: buildPerformerFromLocation(immunization.location),
    },
  };
}

function buildConsumable(immunization: Immunization, referenceId: string) {
  return {
    _typeCode: "CSM",
    manufacturedProduct: {
      _classCode: "MANU",
      templateId: buildInstanceIdentifier({
        root: oids.immunizationMedicationInformation,
        extension: extensionValue2015,
      }),
      manufacturedMaterial: {
        code: buildCodeCvFromCodeableConcept(immunization.vaccineCode, `${referenceId}-material`),
      },
    },
  };
}

function buildSimpleReference(referenceId: string): CdaSimpleReference {
  return {
    reference: {
      _value: referenceId,
    },
  };
}
