import {
  AddressUseCodes,
  ContactSystemCodes,
  Demographics,
  GenderCodes,
  NameUseCodes,
} from "@metriport/commonwell-sdk";

export const patientTracyCrane: Omit<Demographics, "identifier"> = {
  address: [
    {
      use: AddressUseCodes.home,
      postalCode: "01462",
      state: "MA",
      line: ["458 Streich Street"],
      city: "Lunenburg",
    },
  ],
  name: [
    {
      use: NameUseCodes.usual,
      given: ["Tracy"],
      family: ["CraneTest"],
    },
  ],
  gender: GenderCodes.F,
  birthDate: "1936-12-26",
  telecom: [
    {
      value: "2223601564",
      system: ContactSystemCodes.phone,
    },
  ],
};
