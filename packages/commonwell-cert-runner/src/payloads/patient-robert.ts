import {
  AddressUseCodes,
  Demographics,
  GenderCodes,
  NameUseCodes,
} from "@metriport/commonwell-sdk";

export const patientRobertLang: Omit<Demographics, "identifier"> = {
  address: [
    {
      use: AddressUseCodes.home,
      postalCode: "02151",
      state: "MA",
      line: ["930 Rolfson Hollow", "Apt 15"],
      city: "Revere",
    },
  ],
  name: [
    {
      use: NameUseCodes.usual,
      given: ["Robert"],
      family: ["LangTest"],
    },
  ],
  gender: GenderCodes.M,
  birthDate: "1952-12-22",
};
