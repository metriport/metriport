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
