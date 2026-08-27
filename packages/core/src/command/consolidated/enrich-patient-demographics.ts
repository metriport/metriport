import { Address, ContactPoint, Extension, HumanName, Patient } from "@medplum/fhirtypes";
import { normalizeEmailNewSafe, normalizePhoneNumberSafe } from "@metriport/shared";
import { ConsolidatedLinkDemographics, splitName } from "../../domain/patient";
import { LinkGenericAddress, LinkGenericName } from "../../domain/patient-demographics";
import { normalizeAddress as normalizeAddressMpi } from "../../mpi/normalize-address";
import { createExtensionDataSource } from "../../external/fhir/shared/extensions/extension";

type HasExtension = { extension?: Extension[] };

type FhirDemographics = {
  names: HumanName[];
  addresses: Address[];
  telecoms: ContactPoint[];
};

function addExtension<T extends HasExtension>(data: T, extension: Extension): T {
  return {
    ...data,
    extension: [...(data.extension ?? []), extension],
  };
}

function parseJsonSafely<T>(jsonString: string): T | undefined {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return undefined;
  }
}

export function serializeName(name: HumanName): string {
  const firstName = (name.given ?? []).join(" ").trim();
  const lastName = name.family ?? "";
  const nameData = {
    firstName: firstName.trim().toLowerCase(),
    lastName: lastName.trim().toLowerCase(),
  };
  return JSON.stringify(nameData, Object.keys(nameData));
}

export function serializeAddress(address: Address): string {
  const normalized = normalizeAddressMpi(address);
  const linkGeneric: LinkGenericAddress = {
    line: normalized.line ?? [],
    city: normalized.city ?? "",
    state: normalized.state ?? "",
    zip: normalized.postalCode ?? "",
    country: normalized.country ?? "",
  };
  return JSON.stringify(linkGeneric, Object.keys(linkGeneric).sort());
}

export function serializeTelecom(telecom: ContactPoint): string | undefined {
  if (!telecom.value || !telecom.system) return undefined;
  if (telecom.system === "phone") {
    return normalizePhoneNumberSafe(telecom.value) ?? undefined;
  }
  if (telecom.system === "email") {
    return normalizeEmailNewSafe(telecom.value) ?? undefined;
  }
  return undefined;
}

export function convertConsolidatedLinkNameToFhir(nameString: string): HumanName | undefined {
  const nameObj = parseJsonSafely<LinkGenericName>(nameString);
  if (!nameObj || !nameObj.firstName || !nameObj.lastName) return undefined;
  return {
    family: nameObj.lastName,
    given: splitName(nameObj.firstName),
  };
}

export function convertConsolidatedLinkAddressToFhir(addressString: string): Address | undefined {
  const addressObj = parseJsonSafely<LinkGenericAddress>(addressString);
  if (!addressObj || !addressObj.line || addressObj.line.length === 0) return undefined;
  return {
    line: addressObj.line,
    city: addressObj.city,
    state: addressObj.state,
    postalCode: addressObj.zip,
    country: addressObj.country,
  };
}

export function convertConsolidatedLinkTelecomToFhir(
  value: string,
  isEmail: boolean
): ContactPoint {
  return {
    system: isEmail ? "email" : "phone",
    value,
  };
}

export function convertConsolidatedLinkToFhirDemographics(
  demographics: ConsolidatedLinkDemographics
): FhirDemographics {
  const names = demographics.names
    .map(convertConsolidatedLinkNameToFhir)
    .filter((n): n is HumanName => n !== undefined);

  const addresses = demographics.addresses
    .map(convertConsolidatedLinkAddressToFhir)
    .filter((a): a is Address => a !== undefined);

  const telecoms = [
    ...demographics.telephoneNumbers.map(value =>
      convertConsolidatedLinkTelecomToFhir(value, false)
    ),
    ...demographics.emails.map(value => convertConsolidatedLinkTelecomToFhir(value, true)),
  ];

  return { names, addresses, telecoms };
}

export function appendDemographics(
  patient: Patient,
  demographics: FhirDemographics,
  extension?: Extension
): Patient {
  const namesToAdd = extension
    ? demographics.names.map(n => addExtension(n, extension))
    : demographics.names;

  const addressesToAdd = extension
    ? demographics.addresses.map(a => addExtension(a, extension))
    : demographics.addresses;

  const telecomsToAdd = extension
    ? demographics.telecoms.map(t => addExtension(t, extension))
    : demographics.telecoms;

  return {
    ...patient,
    name: [...(patient.name ?? []), ...namesToAdd],
    address: [...(patient.address ?? []), ...addressesToAdd],
    telecom: [...(patient.telecom ?? []), ...telecomsToAdd],
  };
}

export function deduplicateDemographics(patient: Patient): Patient {
  const seenNames = new Set<string>();
  const dedupedNames = (patient.name ?? []).filter(name => {
    const serialized = serializeName(name);
    if (seenNames.has(serialized)) return false;
    seenNames.add(serialized);
    return true;
  });

  const seenAddresses = new Set<string>();
  const dedupedAddresses = (patient.address ?? []).filter(address => {
    const serialized = serializeAddress(address);
    if (seenAddresses.has(serialized)) return false;
    seenAddresses.add(serialized);
    return true;
  });

  const seenTelecoms = new Set<string>();
  const dedupedTelecoms = (patient.telecom ?? []).filter(telecom => {
    const serialized = serializeTelecom(telecom);
    if (!serialized || seenTelecoms.has(serialized)) return false;
    seenTelecoms.add(serialized);
    return true;
  });

  return {
    ...patient,
    ...(dedupedNames.length > 0 ? { name: dedupedNames } : {}),
    ...(dedupedAddresses.length > 0 ? { address: dedupedAddresses } : {}),
    ...(dedupedTelecoms.length > 0 ? { telecom: dedupedTelecoms } : {}),
  };
}

export function enrichPatientDemographics({
  patient,
  consolidatedLinkDemographics,
  conversionBundlePatients,
}: {
  patient: Patient;
  consolidatedLinkDemographics?: ConsolidatedLinkDemographics;
  conversionBundlePatients: Patient[];
}): Patient {
  let result = patient;

  if (consolidatedLinkDemographics) {
    const hieExtension = createExtensionDataSource("CONSOLIDATED_LINK");
    const hieDemographics = convertConsolidatedLinkToFhirDemographics(consolidatedLinkDemographics);
    result = appendDemographics(result, hieDemographics, hieExtension);
  }

  for (const bundlePatient of conversionBundlePatients) {
    const extension = createExtensionDataSource("CONVERSION_BUNDLE");
    result = appendDemographics(
      result,
      {
        names: bundlePatient.name ?? [],
        addresses: bundlePatient.address ?? [],
        telecoms: bundlePatient.telecom ?? [],
      },
      extension
    );
  }

  return deduplicateDemographics(result);
}
