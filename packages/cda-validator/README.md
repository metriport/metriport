# cda-core-2.0

Resources for Clinical Document Architecture (CDA) release 2.0

To run the server on port 8999, just run `npm run server`.

## CDA Schema

The `schema/normative` folder contains the original published CDA Schema. This is the schema which is published with the base/core standard. This is mainly used for historical reference. See "CDA Schema Extensions" below for the latest version that includes all extensions; which most people will want to use.

### CDA Stylesheet

The CDA Stylesheet is located [here](https://github.com/HL7/cda-core-xsl). It is currently being managed by Alex Henket for SDWG.

## CDA Schema Extensions

The `schema/extensions` folder contains an `SDTC` folder which has the updated CDA schema with all SDTC extensions that are approved by HL7.

## FHIR Logical Models for CDA

The FHIR logical models for CDA have been moved to https://github.com/HL7/CDA-core-sd
