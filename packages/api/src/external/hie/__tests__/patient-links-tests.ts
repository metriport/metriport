import { faker } from "@faker-js/faker";
import { PatientData } from "@metriport/core/domain/patient";
import { buildDayjs } from "@metriport/shared/common/date";
import { CwLink } from "../../commonwell-v1/cw-patient-data";
import { CQLink } from "../../carequality/cq-patient-data";

export const createCwLink = ({
  firstName,
  lastName,
  dob,
  genderAtBirth,
  address,
  contact,
}: PatientData): CwLink => {
  return {
    _links: {
      downgrade: {
        href: faker.internet.url(),
      },
    },
    patient: {
      details: {
        name: [
          {
            use: "usual",
            given: firstName.split(",").map(name => name.trim()),
            family: lastName.split(",").map(name => name.trim()),
          },
        ],
        gender: {
          code: genderAtBirth,
        },
        address: address.map(address => ({
          use: "unspecified",
          zip: address.zip,
          city: address.city,
          line: [address.addressLine1, address.addressLine2 ?? ""],
          state: address.state,
          country: address.country,
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
        birthDate: buildDayjs(dob).format("YYYYMMDD"),
      },
    },
    assuranceLevel: "2",
  };
};

export const createCQLink = ({
  firstName,
  lastName,
  dob,
  genderAtBirth,
  address,
  contact,
}: PatientData): CQLink => {
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
};
