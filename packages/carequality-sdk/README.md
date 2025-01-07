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

## Local development

### Testing

In order to run the E2E tests, you need to have the following environment variables set, usually in a `.env` file:

```
CQ_API_MODE=... # dev, staging, production
CQ_TEST_ORG_OID=... # The OID of the organization to be used in E2E tests in prodution
CQ_MANAGEMENT_ORG_OID=... # The OID of the managing organization
CQ_MANAGEMENT_API_KEY=... # API key for the Carequality Management API
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
