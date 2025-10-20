import {
  AddressUseCodes,
  Demographics,
  GenderCodes,
  NameUseCodes,
} from "@metriport/commonwell-sdk";

export const patientRichardEdmundo: Omit<Demographics, "identifier"> = {
  address: [
    {
      use: AddressUseCodes.home,
      postalCode: "01930",
      state: "MA",
      line: ["1065 Hackett Ville", "Suite 4"],
      city: "Gloucester",
    },
  ],
  name: [
    {
      use: NameUseCodes.usual,
      given: ["Richard"],
      family: ["EdmundoXXX"],
    },
  ],
  gender: GenderCodes.M,
  birthDate: "1957-10-25",
};
