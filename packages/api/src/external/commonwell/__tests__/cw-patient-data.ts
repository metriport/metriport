import { faker } from "@faker-js/faker";
import { LinkDemographicsHistory } from "@metriport/core/domain/patient-demographics";
import dayjs from "dayjs";
import { ISO_DATE } from "../../../shared/date";
import { makeBaseDomain } from "../../../domain/__tests__/base-domain";
import { CwLink, CwData, CwPatientData } from "../cw-patient-data";
import { makeAddressStrict } from "../../../domain/medical/__tests__/location-address";
import {
  normalizeAndStringifyNames,
  normalizeAddress,
  stringifyAddress,
} from "../../../domain/medical/patient-demographics";

export function makeCwDataLink(): CwLink {
  const address = makeAddressStrict();
  return {
    _links: {
      self: {
        href: faker.internet.url(),
      },
    },
    assuranceLevel: "2",
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
            value: faker.phone.number(),
          },
          {
            system: "email",
            value: faker.internet.email(),
          },
        ],
      },
    },
  };
}

export function makeLinksHistory(): LinkDemographicsHistory {
  const address = makeAddressStrict();
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
        emails: [faker.internet.email()],
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
