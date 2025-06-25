# `commonwell-sdk`

Utility to simplify CommonWell API integration - by Metriport Inc.

REST API Reference: https://specification.commonwellalliance.org/services/rest-api-reference

Based on the version 4.3 of the CommonWell Services Specification:

https://www.commonwellalliance.org/wp-content/uploads/2025/06/Services-Specification-v4.3-Approved-2025.06.03-1.pdf

## Usage

Make sure the repository is initialized and built, see [README.md](https://github.com/metriport/metriport/blob/develop/README.md) for more details.

Populate the environment variables in the `.env` file.

TODO ENG-200 review this
TODO ENG-200 review this
TODO ENG-200 review this
TODO ENG-200 review this

```
# Required Member Configuration
CW_MEMBER_ID=
CW_MEMBER_OID=
CW_MEMBER_NAME=
CW_MEMBER_CERTIFICATE=
CW_MEMBER_PRIVATE_KEY=

# Required Organization Configuration
CW_ORG_CERTIFICATE=
CW_ORG_PRIVATE_KEY=
CW_ORG_GATEWAY_ENDPOINT=
CW_ORG_GATEWAY_AUTHORIZATION_SERVER_ENDPOINT=
CW_ORG_GATEWAY_AUTHORIZATION_CLIENT_ID=
CW_ORG_GATEWAY_AUTHORIZATION_CLIENT_SECRET=

# Optional Organization Configuration
CW_ORG_ID=  # If set, the cert runner will use this org and not try to create a new one

# Sandbox Configuration
CW_SANDBOX_ORG_OID=
CW_SANDBOX_ORG_NAME=

# Document Contribution Configuration
DOCUMENT_CONTRIBUTION_ORGANIZATION_ID=
DOCUMENT_CONTRIBUTION_PATIENT_FIRST_NAME=
DOCUMENT_CONTRIBUTION_PATIENT_LAST_NAME=
DOCUMENT_CONTRIBUTION_PATIENT_DATE_OF_BIRTH=
DOCUMENT_CONTRIBUTION_PATIENT_GENDER=
DOCUMENT_CONTRIBUTION_PATIENT_ZIP=
DOCUMENT_CONTRIBUTION_FHIR_URL=
DOCUMENT_CONTRIBUTION_URL=

# Document Patient Configuration
DOCUMENT_PATIENT_FIRST_NAME=
DOCUMENT_PATIENT_LAST_NAME=
DOCUMENT_PATIENT_DATE_OF_BIRTH=
DOCUMENT_PATIENT_GENDER=
DOCUMENT_PATIENT_ZIP=

# Legacy Authentication (Deprecated)
DOCUMENT_CONTRIBUTION_AUTH_URL=
DOCUMENT_CONTRIBUTION_CLIENT_ID=
DOCUMENT_CONTRIBUTION_CLIENT_SECRET=
```

Note `CW_ORG_ID` is optional, if set, the cert runner will use this org and not run the Org cert process, which creates a new one.Ø

Then, run the cert runner with the following command:

```shell
$ npm start
```

This will run through the CommonWell certification test cases.

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
