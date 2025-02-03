# Terminology Server

## Overview

This project provides a term server for lookups in SNOMED, ICD, LOINC, and RXNORM, CPT, and CVX and crosswalks between SNOMED and ICD.

## Download Metathesaurus

You can download the Metathesaurus from the following link:  
[Metathesaurus Download](https://www.nlm.nih.gov/research/umls/licensedcontent/umlsknowledgesources.html)  
**Note:** The file is large - 4 GB compressed and 28 GB uncompressed. Releases occur twice a year, so stay alert!

## Getting Started

### Start the Term Server Locally

To start the term server, run the following command:

```bash
npm run start
```

### Seed the Term Server

We currently only support crosswalks for snomed to icd and icd to snomed. To seed the term server for lookups and crosswalks, run the following commands:

```bash
npm run seed-lookup <path-to-zip>
npm run seed-crosswalk <path-to-zip>
```

### Uploading the Database

After seeding, take the `terminology.db` file and upload it to the `umls-terminology` S3 bucket to get the term server working on the infrastructure.

## Testing with Docker

To test the server locally using Docker, run:

```bash
docker-compose build
docker-compose up -d
```

## Supported Systems

Currently, the Term Server supports the following systems:

| System     | URL                                         |
| ---------- | ------------------------------------------- |
| SNOMED     | http://snomed.info/sct                      |
| LOINC      | http://loinc.org                            |
| RXNORM     | http://www.nlm.nih.gov/research/umls/rxnorm |
| CPT        | http://www.ama-assn.org/go/cpt              |
| CVX        | http://hl7.org/fhir/sid/cvx                 |
| ICD-10-PCS | http://hl7.org/fhir/sid/icd-10-pcs          |
| ICD-10-CM  | http://hl7.org/fhir/sid/icd-10-cm           |

## APIs

### POST /code-system/lookup/bulk

Send a `POST` request to this route to look up an array of codes from the supported systems, and receive results containing displays for those codes.

#### Body

A JSON payload, containing an array of FHIR Parameters objects with required `id` and `parameter` fields.

```
[
  {
    "resourceType": "Parameters",
    "id": "abcd1234-abcd-1234-efgh-abcd1234efgh",
    "parameter": [
      {
        "name": "system",
        "valueUri": "http://hl7.org/fhir/sid/icd-10-cm"
      },
      {
        "name": "code",
        "valueCode": "T21.30"
      }
    ]
  }
]

```

### More routes coming soon 🚀

In the near future, we are planning to add a route to do bulk crosswalks between systems. Stay tuned!

```
            ,▄,
          ▄▓███▌
      ▄▀╙   ▀▓▀    ²▄
    ▄└               ╙▌
  ,▀                   ╨▄
  ▌                     ║
                         ▌
                         ▌
,▓██▄                 ╔███▄
╙███▌                 ▀███▀
    ▀▄
      ▀╗▄         ,▄
         '╙▀▀▀▀▀╙''


      by Metriport Inc.

```
