import { Bundle, Encounter, Location, Practitioner } from "@medplum/fhirtypes";
import { toArray } from "@metriport/shared";
import {
  findCompositionResource,
  findResourceInBundle,
  isEncounter,
} from "../../../external/fhir/shared";
import {
  buildAddress,
  buildCodeCe,
  buildCodeCvFromCodeCe,
  buildInstanceIdentifier,
  buildTelecom,
  formatDateToCdaTimestamp,
  withoutNullFlavorObject,
} from "../commons";
import { placeholderOrgOid } from "../constants";
import { AugmentedEncounter } from "./augmented-resources";
import { createAugmentedEncounters } from "./encounters";
import { EncompassingEncounter, ResponsibleParty } from "../../cda-types/shared-types";

function findEncounterInBundle(
  fhirBundle: Bundle,
  encounterId: string | undefined
): Encounter | undefined {
  if (!encounterId) return undefined;
  const resource = findResourceInBundle(fhirBundle, encounterId);
  return isEncounter(resource) ? resource : undefined;
}

export function buildComponentOf(fhirBundle: Bundle): EncompassingEncounter | undefined {
  const composition = findCompositionResource(fhirBundle);
  const encompassingEncId = composition?.encounter?.reference;
  const encounter = findEncounterInBundle(fhirBundle, encompassingEncId);
  if (!encounter) return undefined;

  const augmentedEncounters = createAugmentedEncounters(encounter, fhirBundle);
  const augmentedEncounter = augmentedEncounters[0];
  return augmentedEncounter ? createComponentOf(augmentedEncounter) : undefined;
}

function createComponentOf(encounter: AugmentedEncounter): EncompassingEncounter {
  const classCode = buildCodeCe({
    code: encounter.resource.class?.code,
    codeSystem: encounter.resource.class?.system,
  });
  const code = buildCodeCvFromCodeCe(classCode, encounter.resource.type);

  return {
    encompassingEncounter: {
      id: buildInstanceIdentifier({
        root: placeholderOrgOid,
        extension: encounter.resource.id,
      }),
      code,
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
      responsibleParty: buildResponsibleParty(encounter.practitioners[0], encounter.locations[0]),
      location: {
        healthCareFacility: {
          id: buildInstanceIdentifier({
            root: placeholderOrgOid,
            extension: encounter.resource.id,
          }),
          location: buildLocation(encounter.locations),
        },
      },
    },
  };
}

function buildLocation(location: Location | Location[] | undefined) {
  const locationArray = toArray(location);
  const primaryLocation = locationArray[0];

  return {
    name: primaryLocation?.name,
    addr: buildAddress(primaryLocation?.address),
  };
}

function buildResponsibleParty(
  practitioner: Practitioner | undefined,
  location: Location | undefined
): ResponsibleParty | undefined {
  if (!practitioner) return undefined;

  return {
    assignedEntity: {
      id: buildInstanceIdentifier({
        root: placeholderOrgOid,
        extension: practitioner.id,
      }),
      addr: buildAddress(location?.address),
      telecom: buildTelecom(location?.telecom),
      assignedPerson: {
        name: {
          given: practitioner.name
            ?.flatMap(n => `${n.given}${n.suffix ? `, ${n.suffix}` : ""}`)
            .join(", "),
          family: practitioner.name?.flatMap(n => n.family).join(", "),
        },
      },
      ...(location?.name && {
        representedOrganization: {
          name: location.name,
        },
      }),
    },
  };
}
