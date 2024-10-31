import { faker } from "@faker-js/faker";
import { LinkDemographicsHistory } from "@metriport/core/domain/patient-demographics";
import dayjs from "dayjs";
import { ISO_DATE } from "../../../shared/date";
import { makeBaseDomain } from "../../../domain/__tests__/base-domain";
import { CQLink, CQData, CQPatientData } from "../cq-patient-data";
import { makeAddressStrict } from "../../../domain/medical/__tests__/location-address";
import {
  normalizeAndStringifyNames,
  normalizeAndStringfyAddress,
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
      gender: faker.helpers.arrayElement(["unknown", "male", "female", "other"]),
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
          value: faker.phone.number("##########"),
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
  const nameOrUndefined = normalizeAndStringifyNames({
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
  });
  const address = makeAddressStrict();
  const addressOrUndefined = normalizeAndStringfyAddress({
    line: [address.addressLine1],
    city: address.city,
    state: address.state,
    zip: address.zip,
    country: address.country,
  });
  return {
    [faker.string.uuid()]: [
      {
        dob: dayjs(faker.date.past()).format(ISO_DATE),
        gender: "male",
        names: nameOrUndefined ? [nameOrUndefined] : [],
        addresses: addressOrUndefined ? [addressOrUndefined] : [],
        telephoneNumbers: [faker.phone.number("##########")],
        emails: [faker.internet.email().toLowerCase()],
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
