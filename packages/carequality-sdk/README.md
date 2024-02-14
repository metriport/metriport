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
    passphrase: "KEY_PASSPHRASE"
});
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
