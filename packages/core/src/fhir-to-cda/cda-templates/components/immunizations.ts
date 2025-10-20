import { Bundle, Immunization, Location } from "@medplum/fhirtypes";
import { encodeToHtml } from "@metriport/shared/common/html";
import { findResourceInBundle, isImmunization, isLocation } from "../../../external/fhir/shared";
import { ImmunizationsSection } from "../../cda-types/sections";
import {
  Consumable,
  ObservationTableRow,
  SubstanceAdministationEntry,
} from "../../cda-types/shared-types";
import {
  buildAddressText,
  buildCodeCe,
  buildCodeCvFromCodeableConcept,
  buildInstanceIdentifier,
  buildOriginalTextReference,
  buildPerformerFromLocation,
  buildTemplateIds,
  formatDateToCdaTimestamp,
  formatDateToHumanReadableFormat,
  getDisplaysFromCodeableConcepts,
  notOnFilePlaceholder,
  withoutNullFlavorObject,
} from "../commons";
import {
  extensionValue2015,
  hl7ActCode,
  loincCodeSystem,
  loincSystemName,
  NOT_SPECIFIED,
  oids,
  placeholderOrgOid,
} from "../constants";
import { createTableRowsAndEntries } from "../create-table-rows-and-entries";
import { initiateSectionTable } from "../table";
import { AugmentedImmunization } from "./augmented-resources";

const immunizationsSectionName = "immunizations";

const tableHeaders = ["Immunization", "Status", "Location", "Date"];

export function buildImmunizations(fhirBundle: Bundle) {
  const immunizationsSection: ImmunizationsSection = {
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
    text: notOnFilePlaceholder,
  };

  const immunizations: Immunization[] =
    fhirBundle.entry?.flatMap(entry => (isImmunization(entry.resource) ? [entry.resource] : [])) ||
    [];

  if (immunizations.length === 0) {
    return {
      _nullFlavor: "NI",
      ...immunizationsSection,
    };
  }

  const augmentedImmunizations = createAugmentedImmunizations(immunizations, fhirBundle);

  const { trs, entries } = createTableRowsAndEntries(
    augmentedImmunizations,
    createTableRowFromImmunization,
    createEntryFromImmunization
  );

  const table = initiateSectionTable(immunizationsSectionName, tableHeaders, trs);

  immunizationsSection.text = table;
  immunizationsSection.entry = entries;

  return immunizationsSection;
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
      return new AugmentedImmunization(
        immunizationsSectionName,
        immunization,
        location,
        locationName
      );
    }
    return new AugmentedImmunization(
      immunizationsSectionName,
      immunization,
      undefined,
      locationName
    );
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
            "#text": encodeToHtml(locationInfo ?? immunization.locationName ?? NOT_SPECIFIED),
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

function createEntryFromImmunization(
  immunization: AugmentedImmunization,
  referenceId: string
): SubstanceAdministationEntry {
  return {
    substanceAdministration: {
      _classCode: "SBADM",
      _moodCode: "EVN",
      _negationInd: false,
      templateId: buildTemplateIds({
        root: immunization.typeOid,
        extension: extensionValue2015,
      }),
      id: buildInstanceIdentifier({
        root: placeholderOrgOid,
        extension: immunization.resource.id,
      }),
      code: buildCodeCe({
        code: "IMMUNIZ",
        codeSystem: hl7ActCode,
        codeSystemName: "ActCode",
      }),
      text: buildOriginalTextReference(referenceId),
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

function buildConsumable(immunization: Immunization, referenceId: string): Consumable {
  return {
    _typeCode: "CSM",
    manufacturedProduct: {
      _classCode: "MANU",
      templateId: buildTemplateIds({
        root: oids.immunizationMedicationInformation,
        extension: extensionValue2015,
      }),
      manufacturedMaterial: {
        code: buildCodeCvFromCodeableConcept(immunization.vaccineCode, `${referenceId}-material`),
      },
    },
  };
}
