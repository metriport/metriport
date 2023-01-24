#!/usr/bin/env node
import {
  AddressUseCodes,
  CommonWell,
  getId,
  IdentifierUseCodes,
  NameUseCodes,
  Person,
  RequestMetadata,
} from "@metriport/commonwell-sdk";
import * as nanoid from "nanoid";

// 1. Person Management
// https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Person-Management-(REST).aspx

export async function personManagement(commonWell: CommonWell, queryMeta: RequestMetadata) {
  // C1: Enroll a person

  console.log(`>>> C1a: Enroll a Person with a Strong ID`);
  const caDriversLicenseUri = "urn:oid:2.16.840.1.113883.4.3.6";
  const driversLicenseId = nanoid.nanoid();
  const personStrongId: Person = {
    details: {
      address: [
        {
          use: AddressUseCodes.home,
          zip: "94041",
          state: "CA",
          line: ["335 Pioneer Way"],
          city: "Mountain View",
        },
      ],
      name: [
        {
          use: NameUseCodes.usual,
          given: ["Paul"],
          family: ["Greyham"],
        },
      ],
      gender: {
        code: "M",
      },
      birthDate: "1980-04-20T00:00:00Z",
      identifier: [
        {
          use: IdentifierUseCodes.usual,
          key: driversLicenseId,
          system: caDriversLicenseUri,
          period: {
            start: "1996-04-20T00:00:00Z",
          },
        },
      ],
    },
  };
  const respC1a = await commonWell.enrollPerson(queryMeta, personStrongId);
  console.log(respC1a);

  console.log(`>>> C1b: Enroll a Person without a Strong ID`);
  const person: Person = {
    details: {
      address: [
        {
          use: AddressUseCodes.home,
          zip: "94111",
          state: "CA",
          line: ["755 Sansome Street"],
          city: "San Francisco",
        },
      ],
      name: [
        {
          use: NameUseCodes.usual,
          given: ["Mary"],
          family: ["Jane"],
        },
      ],
      gender: {
        code: "F",
      },
      birthDate: "2000-04-20T00:00:00Z",
    },
  };

  const respC1b = await commonWell.enrollPerson(queryMeta, person);
  console.log(respC1b);

  // C2: Person search

  console.log(`>>> C2a: Search for a Person using the Strong ID`);
  const respC2a = await commonWell.searchPerson(queryMeta, driversLicenseId, caDriversLicenseUri);
  console.log(respC2a);

  // C2b: Search for a Person using the local Patient demographics.
  // TODO: mplement patient queries

  // C3: Person Update

  console.log(
    `>>> C3a: Update a Person with an existing Strong ID by updating their demographics and/or Strong ID`
  );
  const personId = getId(respC1a);
  personStrongId.details.name[0].family[0] = "Graham";
  const respC3a = await commonWell.updatePerson(queryMeta, personStrongId, personId);
  console.log(respC3a);

  console.log(
    `>>> C3b: Update a Person without a Strong ID by updating their demographics and/or by adding a Strong ID`
  );
  const personId2 = getId(respC1b);
  const driversLicenseId2 = nanoid.nanoid();
  person.details.identifier = [
    {
      use: IdentifierUseCodes.usual,
      key: driversLicenseId2,
      system: caDriversLicenseUri,
      period: {
        start: "2016-04-20T00:00:00Z",
      },
    },
  ];
  const respC3b = await commonWell.updatePerson(queryMeta, person, personId2);
  console.log(respC3b);

  // C4: Patient Match

  // C4a: Search for patients matching the Person demographics.
  // TODO: implement patient queries

  // C6: Unenroll a person

  console.log(`>>> C6a: Unenroll a Person who is active`);
  const respC6a = await commonWell.unenrollPerson(queryMeta, personId2);
  console.log(respC6a);

  // C7: Delete Person

  console.log(
    `>>> C7a: Delete a Person who was previously enrolled with or without a Strong ID and at least one patient link.`
  );
  // Note: will be deleting both persons created in this run
  await commonWell.deletePerson(queryMeta, personId);
  await commonWell.deletePerson(queryMeta, personId2);
}
