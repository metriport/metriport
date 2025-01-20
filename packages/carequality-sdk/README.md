# `carequality-sdk`

SDK to interact with the
[Carequality FHIR R4 directory](https://sequoiaproject.org/SequoiaProjectHealthcareDirectoryImplementationGuide/output/index.html) - by Metriport Inc.

## Usage

```
import {
  APIMode,
  CarequalityManagementApiFhir
} from "@metriport/carequality-sdk";

const api = new CarequalityManagementApiFhir({
    apiKey: "API_KEY",
    apiMode: APIMode.dev,
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
