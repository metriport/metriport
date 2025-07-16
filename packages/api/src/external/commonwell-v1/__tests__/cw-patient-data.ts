import { faker } from "@faker-js/faker";
import { LinkDemographicsHistory } from "@metriport/core/domain/patient-demographics";
import { normalizeEmailNewSafe } from "@metriport/shared";
import dayjs from "dayjs";
import { makeBaseDomain } from "../../../domain/__tests__/base-domain";
import { makeAddressStrict } from "../../../domain/medical/__tests__/location-address";
import {
  normalizeAddress,
  normalizeAndStringifyNames,
  stringifyAddress,
} from "../../../domain/medical/patient-demographics";
import { ISO_DATE } from "../../../shared/date";
import { CwData, CwLink, CwPatientData } from "../cw-patient-data";

export function makeCwDataLink(): CwLink {
  const address = makeAddressStrict();
  const assuranceLevel = faker.helpers.arrayElement(["1", "2", "3"]);
  return {
    _links:
      assuranceLevel === "1"
        ? {
            downgrade: {
              href: faker.internet.url(),
            },
            upgrade: {
              href: faker.internet.url(),
            },
          }
        : assuranceLevel === "2"
        ? {
            downgrade: {
              href: faker.internet.url(),
            },
          }
        : undefined,
    assuranceLevel,
    patient: {
      details: {
        name: [
          {
            family: [faker.person.lastName()],
            given: [faker.person.firstName(), faker.person.firstName()],
          },
        ],
        birthDate: dayjs(faker.date.past()).format(ISO_DATE),
        gender: {
          code: faker.helpers.arrayElement(["M", "F"]),
        },
        identifier: [], // TODO
        address: [
          {
            line: [address.addressLine1],
            city: address.city,
            state: address.state,
            zip: address.zip,
            country: address.country,
          },
        ],
        telecom: [
          {
            system: "phone",
            value: faker.phone.number("##########"),
          },
          {
            system: "email",
            value: faker.internet.email(),
          },
        ],
      },
      provider: {
        type: "organization",
        display: faker.company.name(),
        reference: faker.string.uuid(),
      },
      identifier: [
        {
          key: faker.string.uuid(),
          use: "unspecified",
          system: faker.string.uuid(),
        },
        {
          key: faker.string.uuid(),
          use: "official",
          label: faker.string.uuid(),
          system: faker.string.uuid(),
          assigner: "CommonWell",
        },
      ],
    },
  };
}

export function makeLinksHistory(): LinkDemographicsHistory {
  const address = makeAddressStrict();
  const email = normalizeEmailNewSafe(faker.internet.email()) ?? "test@test.com";
  return {
    [faker.string.uuid()]: [
      {
        dob: dayjs(faker.date.past()).format(ISO_DATE),
        gender: "male",
        names: [
          normalizeAndStringifyNames({
            firstName: faker.person.firstName(),
            lastName: faker.person.lastName(),
          }),
        ],
        addresses: [
          stringifyAddress(
            normalizeAddress({
              line: [address.addressLine1],
              city: address.city,
              state: address.state,
              zip: address.zip,
              country: address.country,
            })
          ),
        ],
        telephoneNumbers: [faker.phone.number("##########")],
        emails: [email],
        driversLicenses: [], // TODO
        ssns: [faker.phone.number("#########")],
      },
    ],
  };
}

export function makeCwData(params: Partial<CwData> = {}): CwData {
  return {
    links: params.links ?? [makeCwDataLink()],
    linkDemographicsHistory: params.linkDemographicsHistory ?? makeLinksHistory(),
  };
}

export function makeCwPatientData(
  params: Partial<Omit<CwPatientData, "data"> & { data: Partial<CwData> }> = {}
): CwPatientData {
  return {
    ...makeBaseDomain(),
    ...(params.id ? { id: params.id } : {}),
    cxId: params.cxId ?? faker.string.uuid(),
    data: makeCwData(params.data),
  };
}
