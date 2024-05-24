import { Patient, PatientDemographicsDiff } from "@metriport/core/domain/patient";
import { Address } from "@metriport/core/domain/address";
import { mapGenderAtBirthToFhir } from "@metriport/core/external/fhir/patient/index";
import { OutboundPatientDiscoveryResp, InboundPatientResource } from "@metriport/ihe-gateway-sdk";
import { updatePatient } from "../../command/medical/patient/update-patient";
import { getCQData } from "./patient";

export type PatientResourceAddress = InboundPatientResource["address"][number];
export type ValidPatientResourceAddress = Omit<
  PatientResourceAddress,
  "line" | "city" | "state" | "postalCode"
> & {
  line: [string, ...string[]];
  city: string;
  state: string;
  postalCode: string;
};

export async function updateDemographics(
  patient: Patient,
  pdResults: OutboundPatientDiscoveryResp[]
) {
  const patientDemographicsDiff = createPatientDemographicsDiff(patient, pdResults);
  const facilityId = getCQData(patient.data.externalData)?.pdFacilityId;
  if (facilityId && patientDemographicsDiff) {
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
  pdResults: OutboundPatientDiscoveryResp[]
): PatientDemographicsDiff | undefined {
  const patientResources = getPatientResources(pdResults).filter(pd =>
    filterPatientResources(patient, pd)
  );
  const newAddresses: Address[] = patientResources
    .flatMap(pr => {
      return pr.address.flatMap((prAddress: PatientResourceAddress) => {
        const validPrAddress: ValidPatientResourceAddress | undefined =
          checkAndReturnValidPrAddress(prAddress);
        if (!validPrAddress) return [];
        const isNew = patient.data.address.every((existingAddress: Address) =>
          checkNonMatchingPrAddress(validPrAddress, existingAddress)
        );
        if (!isNew) return [];
        return validPrAddress;
      });
    })
    .map(convertPrAddress);
  if (newAddresses.length > 0) {
    return {
      address: newAddresses,
    };
  }
  return;
}

function getPatientResources(pdResults: OutboundPatientDiscoveryResp[]): InboundPatientResource[] {
  return pdResults.flatMap(pd => {
    const match = pd.patientMatch;
    if (!match) return [];
    const patientResource = pd.patientResource;
    if (!patientResource) return [];
    return patientResource;
  });
}

function filterPatientResources(
  patient: Patient,
  patientResource: InboundPatientResource
): boolean {
  return (
    patient.data.dob !== patientResource.birthDate ||
    mapGenderAtBirthToFhir(patient.data.genderAtBirth) !== patientResource.gender
  );
}

function checkAndReturnValidPrAddress(
  address: PatientResourceAddress
): ValidPatientResourceAddress | undefined {
  if (
    address.line !== undefined &&
    address.line.length > 0 &&
    address.city !== undefined &&
    address.state !== undefined &&
    address.postalCode !== undefined
  ) {
    return {
      ...address,
      line: address.line as [string, ...string[]],
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
    };
  }
  return;
}

function checkNonMatchingPrAddress(
  address1: ValidPatientResourceAddress,
  address2: Address
): boolean {
  return (
    address1.line[0] !== address2.addressLine1 ||
    address1.city !== address2.city ||
    address1.state !== address2.state ||
    address1.postalCode !== address2.zip
  );
}

function convertPrAddress(address: ValidPatientResourceAddress): Address {
  return {
    addressLine1: address.line[0],
    addressLine2: address.line[1],
    city: address.city,
    state: address.state as Address["state"],
    zip: address.postalCode,
    country: address.country,
  };
}
