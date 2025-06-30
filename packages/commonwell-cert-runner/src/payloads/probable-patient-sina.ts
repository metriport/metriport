import { faker } from "@faker-js/faker";
import {
  AddressUseCodes,
  ContactSystemCodes,
  Demographics,
  GenderCodes,
  NameUseCodes,
} from "@metriport/commonwell-sdk";

export function createProbablePatientSina(): Omit<Demographics, "identifier"> {
  return {
    address: [
      {
        use: AddressUseCodes.home,
        postalCode: faker.location.zipCode(),
        state: faker.location.state(),
        line: [faker.location.streetAddress()],
        city: faker.location.city(),
      },
    ],
    name: [
      {
        use: NameUseCodes.usual,
        given: ["Sina"],
        family: ["WiegandDemo"],
      },
    ],
    gender: GenderCodes.F,
    birthDate: "1956-01-22",
    telecom: [
      {
        value: "2223456789",
        system: ContactSystemCodes.phone,
      },
    ],
  };
}
