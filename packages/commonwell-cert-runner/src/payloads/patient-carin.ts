import {
  AddressUseCodes,
  Demographics,
  GenderCodes,
  NameUseCodes,
} from "@metriport/commonwell-sdk";
import { KnownIdentifierSystems } from "@metriport/commonwell-sdk/models/identifier";

export const patientConnieCarin: Demographics = {
  address: [
    {
      use: AddressUseCodes.home,
      postalCode: "01890",
      state: "MA",
      line: ["681 Schumm View"],
      city: "Winchester",
    },
  ],
  name: [
    {
      use: NameUseCodes.usual,
      given: ["Connie"],
      family: ["CarinTest"],
    },
  ],
  gender: GenderCodes.F,
  birthDate: "1945-01-12",
  identifier: [
    {
      use: "official",
      type: "SSN",
      value: "109887878",
      system: KnownIdentifierSystems.SSN,
    },
  ],
};
