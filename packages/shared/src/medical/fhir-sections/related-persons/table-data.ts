import { RelatedPerson } from "@medplum/fhirtypes";
import { getResourcesFromBundle, MappedConsolidatedResources, SectionKey } from "..";

export type RelatedPersonRowData = {
  id: string;
  name: string;
  relationships: string;
  contacts: string;
  addresses: string;
};

export function relatedPersonTableData({ bundle }: { bundle: MappedConsolidatedResources }) {
  const relatedPersons = getResourcesFromBundle<RelatedPerson>(bundle, "RelatedPerson");

  return {
    key: "relatedPersons" as SectionKey,
    rowData: getRelatedPersonRowData({ relatedPersons }),
  };
}

function getRelatedPersonRowData({
  relatedPersons,
}: {
  relatedPersons: RelatedPerson[];
}): RelatedPersonRowData[] {
  return relatedPersons?.map(relatedPerson => ({
    id: relatedPerson.id ?? "-",
    name: getRelatedPersonsName(relatedPerson),
    relationships: getRelatedPersonsRelationships(relatedPerson),
    contacts: renderRelatedPersonContacts(relatedPerson),
    addresses: renderRelatedPersonAddresses(relatedPerson) ?? "-",
  }));
}

function getRelatedPersonsName(relatedPerson: RelatedPerson): string {
  const names: string[] = [];

  if (relatedPerson.name) {
    for (const name of relatedPerson.name) {
      if (name.text) {
        names.push(name.text);
      } else {
        const parts: string[] = [];
        if (name.prefix) {
          parts.push(name.prefix.join(" "));
        }
        if (name.given) {
          parts.push(name.given.join(" "));
        }
        if (name.family) {
          parts.push(name.family);
        }
        names.push(parts.join(" "));
      }
    }
  }

  return names.join(", ");
}

function getRelatedPersonsRelationships(relatedPerson: RelatedPerson): string {
  const relationships: string[] = [];

  if (relatedPerson.relationship) {
    for (const relationship of relatedPerson.relationship) {
      if (relationship.coding) {
        for (const coding of relationship.coding) {
          if (coding.display) {
            relationships.push(coding.display);
          }
        }
      }
    }
  }

  return relationships.join(", ");
}

function renderRelatedPersonContacts(relatedPerson: RelatedPerson) {
  const contacts = relatedPerson.telecom?.map(telecom => {
    return `${telecom.system}${telecom.use ? `- ${telecom.use}` : ""}: ${telecom.value}`;
  });

  return contacts?.join(", ") ?? "-";
}

function renderRelatedPersonAddresses(relatedPerson: RelatedPerson) {
  const addresses = relatedPerson.address?.map(address => {
    return `${address.line?.join(", ")} ${address.city}, ${address.state} ${address.postalCode}`;
  });

  return addresses?.join(", ") ?? "-";
}
