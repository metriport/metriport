## CDA Validator

This is a clone of the [CDA-validator](Original repository: https://github.com/HL7/CDA-core-2.1), which contains only the schema and extensions components of the original repo.

We have added a server and a `/validate` route to allow us to check the validity of Clinical Documents. Some error handling is done in the `server.ts` file.

To run the server on port 8999, just run `npm run server`.

### CDA Schema

The `schema/normative` folder contains the original published CDA Schema. This is the schema which is published with the base/core standard. This is mainly used for historical reference. See "CDA Schema Extensions" below for the latest version that includes all extensions; which most people will want to use.

### CDA Schema Extensions

The `schema/extensions` folder contains an `SDTC` folder which has the updated CDA schema with all SDTC extensions that are approved by HL7.
