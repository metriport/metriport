import { TcmEncounterResult } from "../../../command/medical/tcm-encounter/get-tcm-encounters";

export type TcmEncounterDTO = Omit<TcmEncounterResult, "patientData"> & {
  patientName: string;
  patientFirstName: string;
  patientLastName: string;
  patientDateOfBirth: string;
  patientPhoneNumbers: string[];
  patientStates: string[];
  patientFacilityIds: string[];
};

export function dtoFromTcmEncounter(queryResult: TcmEncounterResult): TcmEncounterDTO {
  const { patientData, ...encounterData } = queryResult;

  return {
    ...encounterData,
    patientName: patientData.firstName + " " + patientData.lastName,
    patientFirstName: patientData.firstName,
    patientLastName: patientData.lastName,
    patientDateOfBirth: patientData.dob,
    patientPhoneNumbers:
      patientData.contact?.flatMap(contact => (contact.phone ? [contact.phone] : [])) ?? [],
    patientStates:
      patientData.address?.flatMap(address => (address.state ? [address.state] : [])) ?? [],
    patientFacilityIds: encounterData.patientFacilityIds ?? [],
  };
}
