# `commonwell-sdk`

SDK to simplify CommonWell API integration - by Metriport Inc.

## Usage

To connect to the CommonWell API, you can use the one of the options below:

- `CommonWellMember` class:
  - This class is used to connect to the CommonWell API as a member organization.
  - It is used to create, update, and delete organizations, certificates, and other resources.
- `CommonWell` class:
  - This class is used to connect to the CommonWell API as a contributor organization.
  - It is used to create, update, link, and delete patients, query documents, and other resources.

### CommonWellMember

```typescript
import { APIMode, CommonWellMember } from "@metriport/commonwell-sdk";

const commonWellMember = new CommonWellMember({
  orgCert: "<member-certificate-string>",
  rsaPrivateKey: "<member-private-key-string>",
  memberName: "<member-name>",
  memberId: "<member-id>",
  apiMode: APIMode.integration, // or APIMode.production
});
```

### CommonWell

```typescript
import { APIMode, CommonWell } from "@metriport/commonwell-sdk";

const commonWell = new CommonWell({
  orgCert: "<contributor-certificate-string>",
  rsaPrivateKey: "<contributor-private-key-string>",
  orgName: "<contributor-name>",
  oid: "<contributor-id>",
  homeCommunityId: "<contributor-home-community-id>",
  npi: "<contributor-npi>",
  apiMode: APIMode.integration, // or APIMode.production
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
