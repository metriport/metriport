import {
  AddressUseCodes,
  Demographics,
  GenderCodes,
  NameUseCodes,
} from "@metriport/commonwell-sdk";

export const patientMaryLopez: Omit<Demographics, "identifier"> = {
  address: [
    {
      use: AddressUseCodes.home,
      postalCode: "02113",
      state: "MA",
      line: ["647 Tromp Path"],
      city: "Boston",
    },
  ],
  name: [
    {
      use: NameUseCodes.usual,
      given: ["Mary"],
      family: ["LopezQQQ"],
    },
  ],
  gender: GenderCodes.F,
  birthDate: "1937-07-12",
};
