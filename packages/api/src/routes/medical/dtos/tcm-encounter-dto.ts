import { TcmEncounterResult } from "../../../command/medical/tcm-encounter/get-tcm-encounters";

export type TcmEncounterDTO = Omit<TcmEncounterResult, "patientData"> & {
  patientName: string;
  patientDateOfBirth: string;
  patientPhoneNumbers: string[];
  patientStates: string[];
};

export function dtoFromTcmEncounter(queryResult: TcmEncounterResult): TcmEncounterDTO {
  const { patientData, ...encounterData } = queryResult;

  return {
    ...encounterData,
    patientName: patientData.firstName + " " + patientData.lastName,
    patientDateOfBirth: patientData.dob,
    patientPhoneNumbers:
      patientData.contact?.flatMap(contact => (contact.phone ? [contact.phone] : [])) ?? [],
    patientStates:
      patientData.address?.flatMap(address => (address.state ? [address.state] : [])) ?? [],
  };
}
