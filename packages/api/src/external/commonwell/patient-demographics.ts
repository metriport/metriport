import { NetworkLink, PatientNetworkLink } from "@metriport/commonwell-sdk";
import { Patient, PatientDemographicsDiff } from "@metriport/core/domain/patient";
import { Address } from "@metriport/core/domain/address";
import { updatePatient } from "../../command/medical/patient/update-patient";

export type PatientNetworkLinkAddress = PatientNetworkLink["details"]["address"][number];
export type ValidPatientNetworkLinkAddress = Omit<
  PatientNetworkLinkAddress,
  "line" | "city" | "state"
> & {
  line: [string, ...string[]];
  city: string;
  state: string;
};

export async function updateDemographics(
  patient: Patient,
  networkLinks: NetworkLink[],
  facilityId: string
) {
  const patientDemographicsDiff = createPatientDemographicsDiff(patient, networkLinks);
  if (patientDemographicsDiff) {
    updatePatient({
      id: patient.id,
      cxId: patient.cxId,
      facilityId,
      ...patient.data,
      address: [...patient.data.address, ...patientDemographicsDiff.address],
    });
  }
}

function createPatientDemographicsDiff(
  patient: Patient,
  netLinkResults: NetworkLink[]
): PatientDemographicsDiff | undefined {
  const patientNetworkLinks: PatientNetworkLink[] = getPatientNetworkLinks(netLinkResults);
  const newAddresses: Address[] = patientNetworkLinks
    .flatMap((pnl: PatientNetworkLink) => {
      return pnl.details.address.flatMap((newAddress: PatientNetworkLinkAddress) => {
        const validNlAddress: ValidPatientNetworkLinkAddress | undefined =
          checkAndReturnValidNlAddress(newAddress);
        if (!validNlAddress) return [];
        const isNew = patient.data.address.every((existingAddress: Address) =>
          checkNonMatchingAddress(validNlAddress, existingAddress)
        );
        if (!isNew) return [];
        return validNlAddress;
      });
    })
    .map(convertNlAddress);
  if (newAddresses.length > 0) {
    return {
      address: newAddresses,
    };
  }
  return;
}

function getPatientNetworkLinks(netLinkResults: NetworkLink[]): PatientNetworkLink[] {
  return netLinkResults.flatMap(pd => {
    const patientNewtorkLink = pd.patient;
    if (!patientNewtorkLink) return [];
    return patientNewtorkLink;
  });
}

function checkAndReturnValidNlAddress(
  address: PatientNetworkLinkAddress
): ValidPatientNetworkLinkAddress | undefined {
  if (
    address.line !== undefined &&
    address.line != null &&
    address.line.length > 0 &&
    address.city !== undefined &&
    address.city != null &&
    address.state !== undefined &&
    address.state !== null
  ) {
    return {
      ...address,
      line: address.line as [string, ...string[]],
      city: address.city,
      state: address.state,
    };
  }
  return;
}

function checkNonMatchingAddress(
  address1: ValidPatientNetworkLinkAddress,
  address2: Address
): boolean {
  return (
    address1.line[0] !== address2.addressLine1 ||
    address1.city !== address2.city ||
    address1.state !== address2.state ||
    address1.zip !== address2.zip
  );
}

function convertNlAddress(address: ValidPatientNetworkLinkAddress): Address {
  return {
    addressLine1: address.line[0],
    addressLine2: address.line[1],
    city: address.city,
    state: address.state as Address["state"],
    zip: address.zip,
    country: address.country ?? undefined,
  };
}
