import { faker } from "@faker-js/faker";
import { CwLinkV2, Patient } from "@metriport/commonwell-sdk/models/patient";
import { PatientData } from "@metriport/core/domain/patient";
import { buildDayjs } from "@metriport/shared/common/date";
import { makeAddressStrict } from "../../../domain/medical/__tests__/location-address";
import { CQLink } from "../../carequality/cq-patient-data";
import { mapGenderAtBirthToCw } from "../../commonwell-v2/patient/patient-conversion";
import { NetworkLink } from "../../commonwell-v2/patient/types";

export function makeCwLink({
  patientData,
  orgSystem,
}: {
  patientData?: PatientData;
  orgSystem?: string;
}): CwLinkV2 {
  const { firstName, lastName, dob, genderAtBirth, address, contact } =
    patientData ?? getDummyPatientData();
  const patient: Patient = {
    identifier: [
      {
        value: faker.string.uuid(),
        system: "test-system",
      },
    ],
    name: [
      {
        given: firstName.split(",").map(name => name.trim()),
        family: lastName.split(",").map(name => name.trim()),
      },
    ],
    gender: mapGenderAtBirthToCw(genderAtBirth),
    birthDate: buildDayjs(dob).format("YYYY-MM-DD"),
    address: address.map(address => ({
      line: [address.addressLine1, address.addressLine2 ?? ""],
      city: address.city,
      state: address.state,
      postalCode: address.zip,
      country: address.country ?? "US",
    })),
    telecom:
      contact?.map(contact => {
        if (contact.email) {
          return {
            use: "home",
            value: `mailto:${contact.email}`,
            system: "email",
          };
        }
        if (contact.phone) {
          return {
            use: "home",
            value: `tel:${contact.phone}`,
            system: "phone",
          };
        }
        return {};
      }) ?? [],
    managingOrganization: {
      identifier: [
        {
          system: orgSystem ?? "test-org-system",
        },
      ],
    },
  };

  const networkLink: CwLinkV2 = {
    version: 2,
    Patient: patient,
    Links: {
      Self: faker.internet.url(),
      Unlink: faker.internet.url(),
    },
  };
  return networkLink;
}

export function makeCwNetworkLink({
  patientData,
  orgSystem,
}: {
  patientData?: PatientData;
  orgSystem?: string;
}): NetworkLink {
  const cwLink = makeCwLink({ patientData, orgSystem });

  const networkLink: NetworkLink = {
    type: "probable",
    Patient: cwLink.Patient,
    Links: {
      Self: cwLink.Links.Self,
      Unlink: cwLink.Links.Unlink,
      Link: faker.internet.url(),
    },
  };
  return networkLink;
}

export function createCQLink({
  firstName,
  lastName,
  dob,
  genderAtBirth,
  address,
  contact,
}: PatientData): CQLink {
  return {
    id: faker.string.uuid(),
    oid: "1.2.3.4.5.6.7.8.9.10",
    url: faker.internet.url(),
    systemId: "1.2.3.4.5.6.7.8.9.10",
    patientId: faker.string.alphanumeric(14).toUpperCase(),
    patientResource: {
      name: [
        {
          given: firstName.split(",").map(name => name.trim()),
          family: lastName,
        },
      ],
      gender: genderAtBirth === "M" ? "male" : "female",
      address: address.map(address => ({
        city: address.city.toUpperCase() ?? faker.location.city(),
        line: [address.addressLine1 ?? faker.location.streetAddress(), address.addressLine2 ?? ""],
        state: address.state ?? faker.location.state({ abbreviated: true }),
        country: address.country ?? "US",
        postalCode: address.zip ?? faker.location.zipCode(),
      })),
      telecom:
        contact?.map(contact => {
          if (contact.email) {
            return {
              value: `mailto:${contact.email}`,
              system: "email",
            };
          }
          if (contact.phone) {
            return {
              value: `tel:${contact.phone}`,
              system: "phone",
            };
          }
          return {};
        }) ?? [],
      birthDate: buildDayjs(dob).format("YYYYMMDD"),
    },
  };
}

function getDummyPatientData(): PatientData {
  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    dob: faker.date.past().toISOString(),
    genderAtBirth: faker.helpers.arrayElement(["M", "F"]),
    address: [makeAddressStrict()],
  };
}
