# Metriport API Package

A package to get started using [Metriport](https://metriport.com/) - universal and open-source API for healthcare data.

## Usage

Get started: https://docs.metriport.com/getting-started/connect-quickstart

#### Installation

```
npm install --save @metriport/api
```

#### Setup

`ENVIRONMENT_URL` is optional and defaults to https://api.metriport.com

```
import { Metriport } from "@metriport/api";

const metriportClient = new Metriport("YOUR_API_KEY", "ENVIRONMENT_URL");
```
