import { PatientCreate } from "@metriport/api-sdk";
import { Doc } from "../index";
// import { janeDocs } from "./jane";
// import { ollieDocs } from "./ollie";
// import { andreasDocs } from "./andreas";
// import { aaminaDocs } from "./aamina";
import { damienDocs } from "./damien";
import { emeliaDocs } from "./emelia";
// import { gavinDocs } from "./gavin";
// import { hajraDocs } from "./hajra";
import { heatherDocs } from "./heather";
// import { kylaDocs } from "./kyla";
// import { lexiDocs } from "./lexi";
// import { roryDocs } from "./rory";
import { wandaDocs } from "./wanda";
import { williamDocs } from "./william";

type Patients = {
  patient: PatientCreate;
  docs: Doc[];
};

export const patients: Patients[] = [
  // {
  //   patient: {
  //     firstName: "Jane",
  //     lastName: "Smith",
  //     dob: "1996-02-10",
  //     genderAtBirth: "F",
  //     personalIdentifiers: [],
  //     address: [
  //       {
  //         addressLine1: "123 Arsenal St",
  //         city: "Phoenix",
  //         state: "AZ",
  //         zip: "85300",
  //         country: "USA",
  //       },
  //     ],
  //   },
  //   docs: janeDocs,
  // },
  // {
  //   patient: {
  //     firstName: "Ollie",
  //     lastName: "Brown",
  //     dob: "1946-03-18",
  //     genderAtBirth: "M",
  //     personalIdentifiers: [],
  //     address: [
  //       {
  //         addressLine1: "201 Armada St",
  //         city: "Harrisburg",
  //         state: "PA",
  //         zip: "15300",
  //         country: "USA",
  //       },
  //     ],
  //   },
  //   docs: ollieDocs,
  // },
  // {
  //   patient: {
  //     firstName: "Andreas",
  //     lastName: "Sims",
  //     dob: "1952-01-01",
  //     genderAtBirth: "M",
  //     personalIdentifiers: [],
  //     address: [
  //       {
  //         addressLine1: "4430 York St",
  //         city: "Jefferson City",
  //         state: "MO",
  //         zip: "64000",
  //         country: "USA",
  //       },
  //     ],
  //   },
  //   docs: andreasDocs,
  // },
  // {
  //   patient: {
  //     firstName: "Kyla",
  //     lastName: "Fields",
  //     dob: "1927-05-23",
  //     genderAtBirth: "F",
  //     personalIdentifiers: [],
  //     address: [
  //       {
  //         addressLine1: "332 16th St",
  //         city: "Portland",
  //         state: "ME",
  //         zip: "04000",
  //         country: "USA",
  //       },
  //     ],
  //   },
  //   docs: kylaDocs,
  // },
  // {
  //   patient: {
  //     firstName: "Hajra",
  //     lastName: "Powers",
  //     dob: "2001-04-04",
  //     genderAtBirth: "F",
  //     personalIdentifiers: [],
  //     address: [
  //       {
  //         addressLine1: "1984 Juniper Way",
  //         city: "Sacramento",
  //         state: "CA",
  //         zip: "95300",
  //         country: "USA",
  //       },
  //     ],
  //   },
  //   docs: hajraDocs,
  // },
  // {
  //   patient: {
  //     firstName: "Rory",
  //     lastName: "Mills",
  //     dob: "1959-09-09",
  //     genderAtBirth: "M",
  //     personalIdentifiers: [],
  //     address: [
  //       {
  //         addressLine1: "891 E. Galvin Court",
  //         city: "Ames",
  //         state: "IA",
  //         zip: "51500",
  //         country: "USA",
  //       },
  //     ],
  //   },
  //   docs: roryDocs,
  // },
  // {
  //   patient: {
  //     firstName: "Lexi",
  //     lastName: "Stevenson",
  //     dob: "1928-03-26",
  //     genderAtBirth: "F",
  //     personalIdentifiers: [],
  //     address: [
  //       {
  //         addressLine1: "85 Hillside Street",
  //         city: "Springfield",
  //         state: "IL",
  //         zip: "62600",
  //         country: "USA",
  //       },
  //     ],
  //   },
  //   docs: lexiDocs,
  // },
  // {
  //   patient: {
  //     firstName: "Aamina",
  //     lastName: "Alexander",
  //     dob: "1954-10-01",
  //     genderAtBirth: "F",
  //     personalIdentifiers: [],
  //     address: [
  //       {
  //         addressLine1: "796 Thorne Lane",
  //         city: "Austin",
  //         state: "TX",
  //         zip: "75400",
  //         country: "USA",
  //       },
  //     ],
  //   },
  //   docs: aaminaDocs,
  // },
  // {
  //   patient: {
  //     firstName: "Gavin",
  //     lastName: "Blackwell",
  //     dob: "1948-05-10",
  //     genderAtBirth: "M",
  //     personalIdentifiers: [],
  //     address: [
  //       {
  //         addressLine1: "7028 Stillwater Street",
  //         city: "Tallahassee",
  //         state: "FL",
  //         zip: "34600",
  //         country: "USA",
  //       },
  //     ],
  //   },
  //   docs: gavinDocs,
  // },
  {
    patient: {
      firstName: "William",
      lastName: "Donovan",
      dob: "1955-09-14",
      genderAtBirth: "M",
      personalIdentifiers: [],
      address: [
        {
          addressLine1: "7362 Canterbury Street",
          city: "New Orleans",
          state: "LA",
          zip: "71200",
          country: "USA",
        },
      ],
    },
    docs: williamDocs,
  },
  {
    patient: {
      firstName: "Wanda",
      lastName: "Walsh",
      dob: "1941-02-19",
      genderAtBirth: "F",
      personalIdentifiers: [],
      address: [
        {
          addressLine1: "7517 Cooper Street",
          city: "Santa Fe",
          state: "NM",
          zip: "87400",
          country: "USA",
        },
      ],
    },
    docs: wandaDocs,
  },
  {
    patient: {
      firstName: "Damien",
      lastName: "Jensen",
      dob: "1964-08-23",
      genderAtBirth: "M",
      personalIdentifiers: [],
      address: [
        {
          addressLine1: "1440 Mallard Dr",
          city: "Springfield",
          state: "IL",
          zip: "61200",
          country: "USA",
        },
      ],
    },
    docs: damienDocs,
  },
  {
    patient: {
      firstName: "Emelia",
      lastName: "Crane",
      dob: "1944-07-30",
      genderAtBirth: "F",
      personalIdentifiers: [],
      address: [
        {
          addressLine1: "9366 Piper Street",
          city: "Denver",
          state: "CO",
          zip: "81300",
          country: "USA",
        },
      ],
    },
    docs: emeliaDocs,
  },
  {
    patient: {
      firstName: "Heather",
      lastName: "Alverez",
      dob: "1939-11-01",
      genderAtBirth: "F",
      personalIdentifiers: [],
      address: [
        {
          addressLine1: "670 9th Ave",
          city: "Harrisburg",
          state: "PA",
          zip: "15300",
          country: "USA",
        },
      ],
    },
    docs: heatherDocs,
  },
];
