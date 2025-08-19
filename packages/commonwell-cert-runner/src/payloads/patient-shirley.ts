import {
  AddressUseCodes,
  ContactSystemCodes,
  Demographics,
  GenderCodes,
  NameUseCodes,
} from "@metriport/commonwell-sdk";

export const patientShirleyDouglas: Omit<Demographics, "identifier"> = {
  address: [
    {
      use: AddressUseCodes.home,
      postalCode: "01940",
      state: "MA",
      line: ["296 Feest Esplanade", "Suite 93"],
      city: "Lynn",
    },
  ],
  name: [
    {
      use: NameUseCodes.usual,
      given: ["Shirley"],
      family: ["DouglasTest"],
    },
  ],
  gender: GenderCodes.F,
  birthDate: "1984-03-20",
  telecom: [
    {
      value: "2227465988",
      system: ContactSystemCodes.phone,
    },
  ],
};
