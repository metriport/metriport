# `commonwell-cert-runner`

CommonWell Certification Runner by Metriport Inc.

Tool to run through Edge System CommonWell certification test cases.

## Install

To install the program, execute the following command on your terminal:

`npm i -g @metriport/commonwell-cert-runner`

Note: you may have to run the command with `sudo`.

## Usage

After installation, create a `.env` file defining the following variables:

- `COMMONWELL_ORG_NAME`: the organization that will be making the requests.
- `COMMONWELL_OID`: the organization ID.
- `COMMONWELL_SANDBOX_ORG_NAME`: the organization on sandbox for patient management and document contribution
  - should be configured with your FHIR server and OAuth 2 data on Commonwell management portal
- `COMMONWELL_SANDBOX_OID`: the ID of the organization above
- `COMMONWELL_ORG_PRIVATE_KEY`: the RSA256 private key corresponding to the specified organization.
- `COMMONWELL_ORG_CERTIFICATE`: the public certificate/key corresponding to the private key.
- `COMMONWELL_MEMBER_OID`: the member ID for organization management
- `COMMONWELL_MEMBER_PRIVATE_KEY`: the RSA256 private key corresponding to the specified member management organization.
- `COMMONWELL_MEMBER_CERTIFICATE`: the public certificate/key corresponding to the private key.
- `DOCUMENT_PATIENT_FIRST_NAME`: the first name of a patient created along with the sandbox that has a document associated
- `DOCUMENT_PATIENT_LAST_NAME`: their last name
- `DOCUMENT_PATIENT_DATE_OF_BIRTH`: their date of birth on the format YYYY-MM-DD
- `DOCUMENT_PATIENT_GENDER`: their gender (M|F)
- `DOCUMENT_PATIENT_ZIP`: their address zip code
- `DOCUMENT_CONTRIBUTION_ORGANIZATION_ID`: organization suffix for the document contribution flow (usually in the format
  "2.dddddd", with 'd' being a digit)
- `DOCUMENT_CONTRIBUTION_PATIENT_FIRST_NAME`: the first name of the patient to be created on the organization used for the
  document contribution flow - same for the properties below [optional, defaults to the same name from the document patient
  above]
- `DOCUMENT_CONTRIBUTION_PATIENT_LAST_NAME`
- `DOCUMENT_CONTRIBUTION_PATIENT_DATE_OF_BIRTH`
- `DOCUMENT_CONTRIBUTION_PATIENT_GENDER`
- `DOCUMENT_CONTRIBUTION_PATIENT_ZIP`
- `DOCUMENT_CONTRIBUTION_URL`: the url of the server where the documents are stored
- `DOCUMENT_CONTRIBUTION_FHIRURL`: the direct url of the FHIR server where the documents are stored, with no authentication required
- `DOCUMENT_CONTRIBUTION_AUTH_URL`: the url of the server used to authenticate document contribution requests
- `DOCUMENT_CONTRIBUTION_CLIENT_ID`: the client OAuth ID to authenticate document contribution requests
- `DOCUMENT_CONTRIBUTION_CLIENT_SECRET`: the client OAuth secret to authenticate document contribution requests

flow - must exist on the sandbox organization

Example file content looks like:

```
COMMONWELL_ORG_NAME=Metriport
COMMONWELL_OID=2.16.840.1.113883.3.9621
COMMONWELL_SANDBOX_ORG_NAME=Metriport-OrgA-1620
COMMONWELL_SANDBOX_OID=2.16.840.1.113883.3.3330.8889429.1620.1
COMMONWELL_ORG_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----"
COMMONWELL_ORG_CERTIFICATE="-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----"
COMMONWELL_MEMBER_OID=1.3.6.1.4.1.18.12.29.2022.945
COMMONWELL_ORG_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----"
COMMONWELL_ORG_CERTIFICATE="-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----"
DOCUMENT_PATIENT_FIRST_NAME="Stephen"
DOCUMENT_PATIENT_LAST_NAME="Pujols1234"
DOCUMENT_PATIENT_DATE_OF_BIRTH="1955-10-23"
DOCUMENT_PATIENT_GENDER="M"
DOCUMENT_PATIENT_ZIP="62732"
# This is optional, if not set the runner will attempt to create the patient above on the sandbox org
DOCUMENT_CONTRIBUTION_PATIENT_ID=<patient-id>%5E%5E%5Eurn%3aoid%3a<org-id>
```

After the file is created, you can run execute following command on your terminal to run the program:

`cw-cert-runner --env-file "/path/to/created/env/file/.env"`

## Options

`--env-file <file-path>`

Absolute path to the .env file containing required config.

`-V, --version`

Output the version number.

`-h, --help`

Display help for command.

## Development

`npm run build`: builds the package

`npm start`: runs the local code pointing to `./.env`

(optionally) `npm run install-local`: installs the package globally from the local source

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
