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
- `COMMONWELL_PRIVATE_KEY`: the RSA256 private key corresponding to the specified organization.
- `COMMONWELL_CERTIFICATE`: the public certificate/key corresponding to the private key.
- `DOCUMENT_PATIENT_FIRST_NAME`: the first name of a patient created along with the sandbox that has a document associated.
- `DOCUMENT_PATIENT_LAST_NAME`: their last name
- `DOCUMENT_PATIENT_DATE_OF_BIRTH`: their date of birth on the format YYYY-MM-DD

Example file content looks like:

```
COMMONWELL_ORG_NAME=Metriport
COMMONWELL_OID=2.16.840.1.113883.3.9621
COMMONWELL_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
fkadsjhfhdsakjfhdsakhfkdsahfadshfkhdsfhdsakfdhafkashdfkjhalsdkjf
-----END PRIVATE KEY-----
"
COMMONWELL_CERTIFICATE="-----BEGIN CERTIFICATE-----
asdlkfjladsjflkjdaslkfjdsafjadslfjasdlkfjdsaklfjdkalfjdslfjalkjs
-----END CERTIFICATE-----
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
