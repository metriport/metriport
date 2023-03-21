#!/usr/bin/env node
import { CommonWell, getId, getIdTrailingSlash, RequestMetadata } from "@metriport/commonwell-sdk";
import { StrongId } from "@metriport/commonwell-sdk/lib/models/identifier";

import { makePatient, personStrongId } from "../payloads";

/**
 * This code runs logic to show an issue at the Commonwell API, related to adding strong IDs on patient links.
 *
 * TODO more details/context, and CW case number.
 *
 * Issue @ Metriport: https://github.com/metriport/metriport-internal/issues/425
 * Issue @ Commonwell: ???
 */

// https://generatormr.com/
const driversLicense: StrongId = {
  system: "urn:oid:2.16.840.1.113883.4.3.6", // CA drivers license
  key: "498651177",
};
// https://generatormr.com/
const passport: StrongId = {
  system: "urn:oid:2.16.840.1.113883.4.330",
  key: "590266102",
};
// https://generatormr.com/
const ssn: StrongId = {
  system: "urn:oid:2.16.840.1.113883.4.1",
  key: "825-30-4344",
};
// https://codepen.io/dormenog/pen/bqYYzM
const medicare: StrongId = {
  system: "urn:oid:2.16.840.1.113883.4.572",
  key: "125819RL",
};

export async function patientLinksWithStronIds(commonWell: CommonWell, queryMeta: RequestMetadata) {
  console.log(`>>>>>>>>>>>> Running w/ Drivers License`);
  await runWith(driversLicense, commonWell, queryMeta);
  console.log(`>>>>>>>>>>>> Running w/ Passport`);
  await runWith(passport, commonWell, queryMeta);
  console.log(`>>>>>>>>>>>> Running w/ SSN`);
  await runWith(ssn, commonWell, queryMeta);
  console.log(`>>>>>>>>>>>> Running w/ Medicare`);
  await runWith(medicare, commonWell, queryMeta);
}

async function runWith(id: StrongId, commonWell: CommonWell, queryMeta: RequestMetadata) {
  console.log(`>>> Enroll a Person with a Strong ID`);
  const respEnrollPerson = await commonWell.enrollPerson(queryMeta, {
    ...personStrongId,
    details: {
      ...personStrongId.details,
      identifier: [id],
    },
  });
  console.log(respEnrollPerson);
  const personId = getId(respEnrollPerson);

  console.log(`>>> Register a Patient`);
  const patient = makePatient({ facilityId: commonWell.oid });
  const respRegPatient = await commonWell.registerPatient(queryMeta, {
    ...patient,
    details: {
      ...patient.details,
      identifier: [id],
    },
  });
  console.log(respRegPatient);
  const patientId = getIdTrailingSlash(respRegPatient);
  const referenceLink = respRegPatient._links.self.href;

  console.log(`>>> Create patient link w/ strong ID`);
  const respLink = await commonWell.addPatientLink(queryMeta, personId, referenceLink, id);
  console.log(respLink);

  console.log(`>>> Unenroll the Person`);
  const respUnenrollPerson = await commonWell.unenrollPerson(queryMeta, personId);
  console.log(respUnenrollPerson);

  console.log(`>>> Delete the Person`);
  const respDeletePerson = await commonWell.deletePerson(queryMeta, personId);
  console.log(respDeletePerson);

  console.log(`>>> Delete the Person`);
  const respDeletePatient = await commonWell.deletePatient(queryMeta, patientId);
  console.log(respDeletePatient);
}
