# `commonwell-jwt-maker`

CommonWell JWT Maker by Metriport Inc.

CLI to create a JWT for use in CommonWell queries.

## Install

To install the program, execute the following command on your terminal:

`npm i -g @metriport/commonwell-jwt-maker axios`

Note: you may have to run these commands with `sudo`.

## Usage

After installation, you can run execute following command on your terminal to run the program:

`cw-jwt-maker [options]`

Example invovation:

`cw-jwt-maker --rsa-key "/path/to/private/key/privkey.pem"  --role "ict" --subject-id "John Doe" --org-name "Health Organization" --oid "2.16.840.1.472849.4.2716" --pou "TREATMENT" --npi "5837288472"`

Your JWT will be the output of the program.

## Options

`--rsa-key <file-path>`

Absolute path to the RSA256 private key file corresponding to the specified organization's public key (certificate) - used for signing the JWT.

`--role <practitioner-role>`

The practitioner role of the entity making this request. Valid role values: https://hl7.org/fhir/R4/valueset-practitioner-role.html

`--subject-id <subject-id>`

Free text field used for audit purposes. The value should be user ID or user name of staff using the CommonWell enabled system. Can be a system user if the API call is generated from an automated process instead of an actual user.

`--org-name <organization-name>`

The organization name for the request correspondint to the specified OID.

`--oid <organization-id>`

OID of the org making the request. CW uses this ID to certificate in order to validate the signature on the token.

`--pou <purpose-of-use>`

The purpose of use (POU) for this request. (choices: "TREATMENT","PAYMENT", "OPERATIONS", "SYSADMIN", "FRAUD", "PSYCHOTHERAPY","TRAINING", "LEGAL", "MARKETING", "DIRECTORY", "FAMILY", "PRESENT","EMERGENCY", "DISASTER", "PUBLICHEALTH", "ABUSE", "OVERSIGHT","JUDICIAL", "LAW", "DECEASED", "DONATION", "RESEARCH", "THREAT", "GOVERNMENT", "WORKERSCOMP", "COVERAGE", "REQUEST")

`--npi [npi-number]`

Ten digit National Provider Identifier (optional).

`--payload-hash [payload-hash]`

Only required for Patient IDLink - MurmurHash2 calculation of HTTP POST body (optional).

`-V, --version`

Output the version number.

`-h, --help`

Display help for command.

## Development

`npm run build`: builds the package

`npm run local`: installs the package globally and runs it

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
