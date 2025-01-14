# Metriport API SDK Package

A package to get started using [Metriport](https://metriport.com/) - universal and open-source API for healthcare data.
It’s currently only available for Node-based applications.

## Usage

Check out the documentation at https://docs.metriport.com

### Installation

```
npm install --save @metriport/api-sdk
```

### Setup

#### Medical API

To use the Medical API, create a new instance of the `MetriportMedicalApi` class:

```ts
import { MetriportMedicalApi } from "@metriport/api-sdk";

const metriportClient = new MetriportMedicalApi("YOUR_API_KEY");
```

To connect to the sandbox:

```ts
new MetriportMedicalApi("YOUR_API_KEY", { sandbox: true });
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
