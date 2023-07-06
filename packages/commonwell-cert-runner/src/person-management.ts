#!/usr/bin/env node
import { CommonWell, getId, getIdTrailingSlash, RequestMetadata } from "@metriport/commonwell-sdk";
import * as nanoid from "nanoid";

import {
  caDriversLicenseUri,
  driversLicenseId,
  makePatient,
  personNoStrongId,
  personStrongId,
} from "./payloads";

// 1. Person Management
// https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Person-Management-(REST).aspx

export async function personManagement(commonWell: CommonWell, queryMeta: RequestMetadata) {
  // C1: Enroll a person
  console.log(`>>> C1a: Enroll a Person with a Strong ID`);
  const respC1a = await commonWell.enrollPerson(queryMeta, personStrongId);
  console.log(respC1a);

  console.log(`>>> C1b: Enroll a Person without a Strong ID`);
  const respC1b = await commonWell.enrollPerson(queryMeta, personNoStrongId);
  console.log(respC1b);

  // C2: Person search
  console.log(`>>> C2a: Search for a Person using the Strong ID`);
  const respC2a = await commonWell.searchPerson(queryMeta, driversLicenseId, caDriversLicenseUri);
  console.log(respC2a);

  console.log(`>>> C2b: Search for a Person using the local Patient demographics.`);
  const personId = getId(respC1a);
  if (!personId) throw new Error("No personId on response from enrollPerson");
  const newPatient = await commonWell.registerPatient(
    queryMeta,
    makePatient({ facilityId: commonWell.oid })
  );
  const patientId = getIdTrailingSlash(newPatient);
  if (!patientId) throw new Error("No patientId on response from registerPatient");
  const respC2b = await commonWell.searchPersonByPatientDemo(queryMeta, patientId);
  console.log(respC2b);

  // C3: Person Update
  console.log(
    `>>> C3a: Update a Person with an existing Strong ID by updating their demographics and/or Strong ID`
  );
  personStrongId.details.name[0].family[0] = "Graham";
  const respC3a = await commonWell.updatePerson(queryMeta, personStrongId, personId);
  console.log(respC3a);

  console.log(
    `>>> C3b: Update a Person without a Strong ID by updating their demographics and/or by adding a Strong ID`
  );
  const personId2 = getId(respC1b);
  if (!personId2) throw new Error("No personId2 on response from enrollPerson");
  const driversLicenseId2 = nanoid.nanoid();
  personNoStrongId.details.identifier = [
    {
      use: "usual",
      key: driversLicenseId2,
      system: caDriversLicenseUri,
      period: {
        start: "2016-04-20T00:00:00Z",
      },
    },
  ];
  const respC3b = await commonWell.updatePerson(queryMeta, personNoStrongId, personId2);
  console.log(respC3b);

  // C4: Patient Match
  console.log(`>>> C4a: Search for patients matching the Person demographics.`);
  const respC4a = await commonWell.patientMatch(queryMeta, personId);
  console.log(respC4a);

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

  // Note: delete created patient
  await commonWell.deletePatient(queryMeta, patientId);
}
