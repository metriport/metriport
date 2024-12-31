# `carequality-sdk`

SDK to interact with the [Carequality STU3 directory](https://carequality.org/healthcare-directory/index.html) - by Metriport Inc.

## Usage

```
import {
  APIMode,
  Carequality
} from "@metriport/carequality-sdk";

const Carequality = new Carequality({
    apiKey: "API_KEY",
    apiMode: APIMode.dev,
    orgCert: "ORG_CERTIFICATE",
    rsaPrivateKey: "ORG_PRIVATE_KEY",
    rsaPrivateKeyPassword: "ORG_PRIVATE_KEY_PASSWORD"
});
```

## Local development

### Testing

In order to run the tests, you need to have the following environment variables set, usually in a `.env` file:

```
ORG_OID=... # The OID of the organization to be used in the tests.
API_MODE=... # dev, staging, production
MANAGEMENT_API_KEY=... # API key for the Carequality Management API
ORG_CERTIFICATE=... # The certificate (public key) for the organization.
ORG_PRIVATE_KEY=... # An RSA key corresponding to the specified orgCert.
ORG_PRIVATE_KEY_PASSWORD=... # The password to decrypt the private key.
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
