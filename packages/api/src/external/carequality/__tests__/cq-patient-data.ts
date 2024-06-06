import { faker } from "@faker-js/faker";
import { LinkDemographicsHistory } from "@metriport/core/domain/patient-demographics";
import dayjs from "dayjs";
import { ISO_DATE } from "../../../shared/date";
//import { CQPatientDataModel } from "../models/cq-patient-data";
import { makeBaseDomain } from "../../../domain/__tests__/base-domain";
import { CQLink, CQData, CQPatientData } from "../cq-patient-data";
import { makeAddressStrict } from "../../../domain/medical/__tests__/location-address";
import {
  normalizeAndStringifyNames,
  normalizeAddress,
  stringifyAddress,
} from "../../../domain/medical/patient-demographics";

export function makeCqDataLink(): CQLink {
  const address = makeAddressStrict();
  return {
    patientId: faker.string.uuid(),
    systemId: faker.string.uuid(),
    patientResource: {
      name: [
        {
          family: faker.person.lastName(),
          given: [faker.person.firstName(), faker.person.firstName()],
        },
      ],
      birthDate: dayjs(faker.date.past()).format(ISO_DATE),
      gender: faker.helpers.arrayElement(["undefined", "unknown", "male", "female", "other"]),
      identifier: [], // TODO
      address: [
        {
          line: [address.addressLine1],
          city: address.city,
          state: address.state,
          postalCode: address.zip,
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
    oid: faker.string.uuid(),
    url: faker.string.uuid(),
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

export function makeCqData(params: Partial<CQData> = {}): CQData {
  return {
    links: params.links ?? [makeCqDataLink()],
    linkDemographicsHistory: params.linkDemographicsHistory ?? makeLinksHistory(),
  };
}

export function makeCqPatientData(
  params: Partial<Omit<CQPatientData, "data"> & { data: Partial<CQData> }> = {}
): CQPatientData {
  return {
    ...makeBaseDomain(),
    ...(params.id ? { id: params.id } : {}),
    cxId: params.cxId ?? faker.string.uuid(),
    data: makeCqData(params.data),
  };
}
