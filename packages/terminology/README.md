# Terminology Server

## Overview

This project provides a term server for lookups in the following code systems:

- SNOMED
- ICD10CM
- ICD10PCS
- LOINC
- RXNORM
- CPT
- CVX
- NDC
  as well as these crosswalks:
- SNOMED >> ICD10CM
- ICD10CM >> SNOMED
- NDC >> RXNORM.

Currently, this is mostly intended for internal use.

For a quick walkthrough on setting up and using the Metriport Terminology Server, watch [this video](https://www.loom.com/share/4004e6d5b5c3461e91ed4f72c0143eb1?sid=39df3baa-fd88-4e85-8ecd-dd2591554539).

## Getting Started

### First Time Setup

You'll need the UMLS Metathesaurus to run the terminology server. There are two ways to get it:

**For Metriport devs:**

1. Set up the `.env` with:

```
AWS_REGION=<staging-region>
TERMINOLOGY_BUCKET=<umls-bucket>
```

2. Run `npm run start` - this will automatically download the Metathesaurus from S3 if it's not already in your local directory

**For external users:**

1. Sign up for the UMLS Licence (typically takes a few business days) by following [this link](https://uts.nlm.nih.gov/uts/signup-login).
1. Download the Metathesaurus from [UMLS Knowledge Sources](https://www.nlm.nih.gov/research/umls/licensedcontent/umlsknowledgesources.html)  
   **Note:** The file is large - 4 GB compressed and 28 GB uncompressed. Releases occur twice a year.
1. Put the downloaded zip in the root of the terminology directory.

### Seeding the Database

For the terminology server to work, we need to seed the database with the UMLS Metathesaurus.
You can find this file on NLM's [UMLS Knowledge Sources](https://www.nlm.nih.gov/research/umls/licensedcontent/umlsknowledgesources.html) page.

Once you have the file, start the server and run the following commands:

```bash
npm run seed-lookup <path-to-metathesaurus-zip>
npm run seed-crosswalk <path-to-metathesaurus-zip>
```

Once that's done, you'll have everything besides NDC and its crosswalk to RxNorm.

To seed the NDC codes with descriptions (including packaging data), you'll need to download the FDA's NDC database files - Excel version from [this page](https://www.fda.gov/drugs/drug-approvals-and-databases/national-drug-code-directory), convert them to CSV, and run this command:

```bash
npm run seed-fda-descriptions <path-to-products-file.csv> <path-to-packages-file.csv>
```

Lastly, let's seed the NDC crosswalks from RxNorm.
To do that, download the NLM's [RxNorm package](https://www.nlm.nih.gov/research/umls/rxnorm/docs/rxnormfiles.html) and run this command:

```bash
npm run seed-ndc-lookup <path-to-rxnorm-zip>
```

### Running the Server

Once you have the database file (either uploaded on S3 or seeded locally):

```bash
npm run start
```

The server will look for `terminology.db` in the local directory. If you're a Metriport dev and the file isn't found locally, it will automatically download from S3.

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

### POST /code-system/lookup

Send a `POST` request to this route to look up a single code from one of the supported systems, and receive a result containing the description for that code.

#### Body

A JSON payload, containing a single FHIR Parameters object with required `parameter` fields.

```
  {
    "resourceType": "Parameters",
    "parameter": [
      {
        "name": "system",
        "valueUri": "http://hl7.org/fhir/sid/icd-10-cm"
      },
      {
        "name": "code",
        "valueCode": "R61"
      }
    ]
  }
```

#### Response

A JSON response, containing the code and its textual description.

```
{
    "response": [
        {
            "code": "R61",
            "display": "Generalized hyperhidrosis",
            "property": [
                {
                    "code": "ORDER_NO",
                    "description": "Order number",
                    "value": {
                        "type": "code",
                        "value": "30654"
                    }
                }
            ]
        }
    ]
}
```

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

#### Response

A JSON response, containing an array of codes with their original IDs and their corresponding textual descriptions.

```
[
    {
        "code": "T21.30",
        "id": "abcd1234-abcd-1234-efgh-abcd1234efgh",
        "display": "Burn of third degree of trunk, unspecified site",
        "property": [
            {
                "code": "ORDER_NO",
                "description": "Order number",
                "value": {
                    "type": "code",
                    "value": "71419"
                }
            }
        ]
    }
]
```

### POST /concept-map/translate

Send a `POST` request to this route to translate the code from one system to another.

**Note:** Currently, we support the following translations:

- ICD-10 to SNOMED
- SNOMED to ICD-10

#### Body

A JSON payload, containing a single FHIR Parameters object with required `parameter` fields, containing the source system and its code, as well as the target system.

```
{
  "resourceType": "Parameters",
  "parameter": [
    {
      "name": "system",
      "valueUri": "http://snomed.info/sct"
    },
    {
      "name": "code",
      "valueCode": "312230002"
    },
    {
      "name": "targetsystem",
      "valueUri": "http://hl7.org/fhir/sid/icd-10-cm"
    }
  ]
}
```

#### Response

A JSON response, containing a FHIR ConceptMap resource with the code in the target system and its equivalence to the requested code.

```
{
    "response": {
        "resourceType": "ConceptMap",
        "status": "active",
        "group": [
            {
                "source": "http://snomed.info/sct",
                "target": "http://hl7.org/fhir/sid/icd-10-cm",
                "element": [
                    {
                        "code": "312230002",
                        "target": [
                            {
                                "code": "R61",
                                "equivalence": "equivalent"
                            }
                        ]
                    }
                ]
            }
        ]
    }
}
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
