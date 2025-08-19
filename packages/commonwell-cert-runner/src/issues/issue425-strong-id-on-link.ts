#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  CommonWell,
  getId,
  getIdTrailingSlash,
  RequestMetadata,
  StrongId,
} from "@metriport/commonwell-sdk";

import { makePatient, personStrongId } from "../payloads";

// TODO add CW case number and rename this file accodingly
/**
 * This code runs logic to show an issue at the Commonwell API, related to adding strong IDs on patient links.
 *
 * Import the `patientLinksWithStrongIds` function on the cert runner and comment out the other tests/functions.
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
  // Generic
  // system: "urn:oid:2.16.840.1.113883.4.330",
  // USA
  system: "urn:oid:2.16.840.1.113883.4.330.840",
  key: "515823867",
  // use: IdentifierUseCodes.official,
  // key: driversLicenseId,
  // system: caDriversLicenseUri,
  // period: {
  //   start: "2020-05-21",
  //   end: "2030-05-20",
  // },
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

export async function patientLinksWithStrongIds(
  commonWell: CommonWell,
  queryMeta: RequestMetadata
) {
  console.log(`\n>>>>>>>>>>>> Running w/ Drivers License`);
  await runWith(driversLicense, commonWell, queryMeta);
  console.log(`\n>>>>>>>>>>>> Running w/ SSN`);
  await runWith(ssn, commonWell, queryMeta);
  console.log(`\n>>>>>>>>>>>> Running w/ Passport`);
  await runWith(passport, commonWell, queryMeta);
  console.log(`\n>>>>>>>>>>>> Running w/ Medicare`);
  await runWith(medicare, commonWell, queryMeta);
}

async function runWith(id: StrongId, commonWell: CommonWell, queryMeta: RequestMetadata) {
  let personId: string | undefined;
  try {
    console.log(`>>> Enroll a Person with a Strong ID`);
    const respEnrollPerson = await commonWell.enrollPerson(queryMeta, {
      ...personStrongId,
      details: {
        ...personStrongId.details,
        identifier: [id],
      },
    });
    // console.log(respEnrollPerson);
    console.log(`>>> Enroll a Person with a Strong ID OK`);
    personId = getId(respEnrollPerson);
    if (!personId) throw new Error(`Person ID not found in response to enrollPerson`);
  } catch (err) {
    console.log(
      `___ ERROR enrolling person (CW-Ref: ${commonWell.lastReferenceHeader}): ${getMessage(err)}`
    );
    console.log(`___ ID: ${JSON.stringify(id, null, 2)}`);
    return;
  }

  try {
    console.log(`>>> Register a Patient`);
    const patient = makePatient({ facilityId: commonWell.oid });
    const respRegPatient = await commonWell.registerPatient(queryMeta, {
      ...patient,
      details: {
        ...patient.details,
        identifier: [id],
      },
    });
    const patientId = getIdTrailingSlash(respRegPatient);
    if (!patientId) throw new Error(`Patient ID not found in response of registerPatient`);
    const referenceLink = respRegPatient._links?.self.href;
    if (!referenceLink)
      throw new Error(`Patient reference link not found in response of registerPatient`);
    console.log(`>>> Register a Patient OK`);

    try {
      console.log(`>>> Create patient link w/ strong ID`);
      await commonWell.addPatientLink(queryMeta, personId, referenceLink, id);
      console.log(`>>> Create patient link w/ strong ID OK`);
    } catch (err) {
      console.log(
        `___ ERROR linking (CW-Ref: ${commonWell.lastReferenceHeader}): ${getMessage(err)}`
      );
      console.log(`___ ID: ${JSON.stringify(id, null, 2)}`);
    } finally {
      console.log(`>>> Delete the Patient`);
      await commonWell.deletePatient(queryMeta, patientId);
      console.log(`>>> Delete the Patient OK`);
    }
  } finally {
    console.log(`>>> Unenroll the Person`);
    await commonWell.unenrollPerson(queryMeta, personId);
    console.log(`>>> Unenroll the Person OK`);

    console.log(`>>> Delete the Person`);
    await commonWell.deletePerson(queryMeta, personId);
    console.log(`>>> Delete the Person OK`);
  }
}

function getMessage(error: any): string {
  return error.response?.data?.message ?? error.message;
}
