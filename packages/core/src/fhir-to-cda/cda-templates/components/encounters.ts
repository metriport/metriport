import { Address, Bundle, Encounter, HumanName, Location, Practitioner } from "@medplum/fhirtypes";
import {
  findResourceInBundle,
  isEncounter,
  isLocation,
  isPractitioner,
} from "../../../external/fhir/shared";
import { EncountersSection } from "../../cda-types/sections";
import { ConcernActEntry, EncounterEntry, ObservationTableRow } from "../../cda-types/shared-types";
import {
  buildCodeCe,
  buildCodeCvFromCodeCe,
  buildInstanceIdentifier,
  buildParticipant,
  buildPerformer,
  buildValueCd,
  formatDateToCdaTimestamp,
  formatDateToHumanReadableFormat,
  getDisplaysFromCodeableConcepts,
  withoutNullFlavorObject,
} from "../commons";
import {
  NOT_SPECIFIED,
  extensionValue2015,
  loincCodeSystem,
  loincSystemName,
  oids,
  placeholderOrgOid,
} from "../constants";
import { createTableRowsAndEntries } from "../create-table-rows-and-entries";
import { initiateSectionTable } from "../table";
import { AugmentedEncounter } from "./augmented-resources";

export const encountersSectionName = "encounters";

const tableHeaders = [
  "Reason for Visit",
  "Encounter Type",
  "Attending Provider",
  "Location",
  "Date",
];

export function buildEncounters(fhirBundle: Bundle): EncountersSection {
  const encounters: Encounter[] =
    fhirBundle.entry?.flatMap(entry => (isEncounter(entry.resource) ? [entry.resource] : [])) || [];

  if (encounters.length === 0) {
    return undefined;
  }

  const augmentedEncounters = createAugmentedEncounters(encounters, fhirBundle);

  const { trs, entries } = createTableRowsAndEntries(
    augmentedEncounters,
    createTableRowFromEncounter,
    createEntryFromEncounter
  );

  const table = initiateSectionTable(encountersSectionName, tableHeaders, trs);

  return {
    templateId: buildInstanceIdentifier({
      root: oids.encountersSection,
      extension: extensionValue2015,
    }),
    code: buildCodeCe({
      code: "46240-8",
      codeSystem: loincCodeSystem,
      codeSystemName: loincSystemName,
      displayName: "History of encounters",
    }),
    title: "ENCOUNTERS",
    text: table,
    entry: entries,
  };
}

function createAugmentedEncounters(
  encounters: Encounter[],
  fhirBundle: Bundle
): AugmentedEncounter[] {
  const augEncs = encounters.map(encounter => {
    const practitionerIds = encounter.participant?.flatMap(p =>
      p.individual?.reference?.includes("Practitioner") ? p.individual?.reference : []
    );

    const involvedPractitioners: Practitioner[] = [];
    practitionerIds?.forEach(id => {
      const practitioner = findResourceInBundle(fhirBundle, id);
      if (isPractitioner(practitioner)) involvedPractitioners.push(practitioner);
    });

    const locationIds = encounter.location?.flatMap(l =>
      l.location?.reference?.includes("Location") ? l.location?.reference : []
    );

    const involvedLocations: Location[] = [];
    locationIds?.forEach(id => {
      const location = findResourceInBundle(fhirBundle, id);
      if (isLocation(location)) involvedLocations.push(location);
    });

    return new AugmentedEncounter(
      encountersSectionName,
      encounter,
      involvedPractitioners,
      involvedLocations
    );
  });

  return augEncs;
}

function createTableRowFromEncounter(
  encounter: AugmentedEncounter,
  referenceId: string
): ObservationTableRow[] {
  const locationInfo = getLocationInformation(encounter.locations);
  return [
    {
      tr: {
        _ID: referenceId,
        ["td"]: [
          {
            "#text":
              getDisplaysFromCodeableConcepts(encounter.resource.reasonCode) ?? NOT_SPECIFIED,
          },
          {
            "#text": getDisplaysFromCodeableConcepts(encounter.resource.type) ?? NOT_SPECIFIED,
          },
          {
            "#text": getPractitionerInformation(encounter.practitioners),
          },
          {
            "#text": locationInfo?.map(l => `${l.name} - ${l.address}`).join("\n") ?? NOT_SPECIFIED,
          },
          {
            "#text":
              formatDateToHumanReadableFormat(encounter.resource.period?.start) ?? NOT_SPECIFIED,
          },
        ],
      },
    },
  ];
}

function buildAddressText(address: Address | undefined): string | undefined {
  if (!address) return undefined;
  return `${address.line?.join(", ")}, ${address.city}, ${address.state} ${address.postalCode}`;
}

function getPractitionerInformation(participant: Practitioner[] | undefined): string {
  if (!participant) return NOT_SPECIFIED;

  const practitionerInfo = participant
    .map(p => buildNameText(p.name))
    .filter(Boolean)
    .join("\n");

  return practitionerInfo ?? NOT_SPECIFIED;
}

function getLocationInformation(location: Location[] | undefined) {
  if (!location) return undefined;

  return location.map(l => {
    return { name: l.name, address: buildAddressText(l.address) };
  });
}

function buildNameText(names: HumanName[] | undefined): string | undefined {
  if (!names) return undefined;

  const uniqueNames = new Set<string>();

  names.forEach(n => {
    const firstAndLast = `${n.family}, ${n.given?.join(" ")}`;
    const fullName = n.suffix?.join(" ") ? `${n.suffix?.join(" ")} ${firstAndLast}` : firstAndLast;
    uniqueNames.add(fullName);
  });

  return Array.from(uniqueNames).join("\n");
}

function createEntryFromEncounter(
  encounter: AugmentedEncounter,
  referenceId: string
): EncounterEntry {
  const classCode = buildCodeCe({
    code: encounter.resource.class?.code,
    codeSystem: encounter.resource.class?.system,
  });
  const code = buildCodeCvFromCodeCe(classCode, encounter.resource.type);

  return {
    encounter: {
      _classCode: "ENC",
      _moodCode: "EVN",
      templateId: buildInstanceIdentifier({
        root: encounter.typeOid,
        extension: extensionValue2015,
      }),
      id: buildInstanceIdentifier({
        root: placeholderOrgOid,
        extension: encounter.resource.id,
      }),
      code,
      statusCode: {
        _code: mapEncounterStatusCode(encounter.resource.status),
      },
      effectiveTime: {
        low: withoutNullFlavorObject(
          formatDateToCdaTimestamp(encounter.resource.period?.start),
          "_value"
        ),
        high: withoutNullFlavorObject(
          formatDateToCdaTimestamp(encounter.resource.period?.end),
          "_value"
        ),
      },
      performer: buildPerformer(encounter.practitioners),
      participant: buildParticipant(encounter.locations),
      entryRelationship: createEntryRelationshipObservation(encounter.resource, referenceId),
    },
  };
}

/**
 * For FHIR statuses, see https://hl7.org/fhir/R4/valueset-encounter-status.html
 * For CDA statuses, see https://terminology.hl7.org/5.2.0/ValueSet-v3-ActStatus.html
 */
function mapEncounterStatusCode(status: string | undefined): string {
  if (!status) return "completed";
  switch (status) {
    case "planned":
      return "new";
    case "arrived" || "in-progress":
      return "active";
    case "onleave":
      return "held";
    case "finished":
      return "completed";
    case "cancelled":
      return "nullified";
    default:
      return "completed";
  }
}

export function createEntryRelationshipObservation(
  encounter: Encounter,
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
              codeSystem: "2.16.840.1.113883.3.88.12.3221.7.2", // https://www.findacode.com/snomed/282291009--diagnosis-interpretation.html
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
