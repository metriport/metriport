<p align="center">
  <a href="https://github.com/metriport/metriport">
    <img src="./assets/main-banner.png" alt="Logo">
  </a>

  <p align="center">
    Complete real-time patient context from every source that matters, transformed into relevant intelligence for your care teams and their AI agents.
    <br />
    <a href="https://metriport.com" target="_blank"><strong>Learn more »</strong></a>
    <br />
    <br />
    <a href="https://docs.metriport.com/" target="_blank">Docs</a>
    ·
    <a href="https://metriport.com" target="_blank">Website</a>
    ·
    <a href="https://dash.metriport.com" target="_blank">Dashboard</a>
    ·
    <a href="https://www.npmjs.com/package/@metriport/api-sdk" target="_blank">NPM</a>

  </p>
</p>

<p align="center">
   <a href="https://status.metriport.com/"><img src="https://api.checklyhq.com/v1/badges/checks/6aee48de-8699-4746-8843-80e28366ccb0?style=flat&theme=default" alt="API Status Check"></a>
   <a href="https://github.com/metriport/metriport/stargazers"><img src="https://img.shields.io/github/stars/metriport/metriport" alt="GitHub Stars"></a>
      <a href="https://www.linkedin.com/company/metriport"><img src="https://img.shields.io/static/v1?label=LinkedIn&message=Metriport (YC S22)&color=blue" alt="LinkedIn"></a>
   <a href="https://www.ycombinator.com/companies/metriport"><img src="https://img.shields.io/static/v1?label=Y Combinator&message=Metriport&color=orange" alt="YC"></a>
      <a href="https://twitter.com/metriport"><img src="https://img.shields.io/twitter/follow/metriport?style=social"></a>
  <a href="https://github.com/metriport/metriport/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-AGPLv3-purple" alt="License"></a>
</p>

## **Overview**

Metriport provides real-time access to medical data for 340+ million individuals across the US. Its open-source platform turns scattered patient records across all major healthcare IT systems into structured information that gives clinicians what they need, exactly when they need it, to provide the best possible care.

Metriport manages dozens of connections across all national HIEs and QHINs, state and regional HIEs, ADT networks, pharmacies, labs, and EHRs. It then matches, extracts, standardizes, deduplicates, and enriches records, and converts them into a unified data model, accessible through a single API, data warehouse, or apps directly within an EHR.

In addition to providing longitudinal patient clinical data at the point of care, Metriport offers ambient monitoring, alerting providers in real time as patients are moved through the healthcare system to assist with transitions of care. Metriport also delivers insights on top of the data, like AI medical record summarization, condition suspecting, and surfacing care gaps.

Founded in 2022 and headquartered in San Francisco, Metriport processes 4.2 billion network requests a month and returns the first structured record in under 15 seconds. Teams across care delivery, value-based programs, and health tech platforms build on Metriport, including Amazon One Medical, Strive Health, Color, Sollis Health, and Canvas Medical.

## **Security and Privacy**

Metriport is HITRUST r2 certified, SOC 2 Type 2 certified, and HIPAA compliant. [Visit our trust center](https://security.metriport.com/) to learn more about our security practices.

<p style="text-align: center;">
  <img src="./assets/hitrust.png" width="25%" />
  <img src="./assets/soc2.png" width="20%" />
  <img src="./assets/hipaa.png" width="30%" />
</p>

## **Platform**

Metriport connects to every major source of patient data, harmonizes it into a single record, and delivers it wherever your team works - through an API, a data warehouse, apps inside your EHR, or as ready-made clinical insights.

### **Integrations**

#### **[HIE Networks](https://www.metriport.com/networks/hie-networks)**

<img src="./assets/platform/hie-networks.png" alt="A single Network Query fanning out to Carequality, CommonWell, eHealth Exchange, and TEFCA/QHINs, plus a map of state and regional HIE coverage" width="100%" />

A single Network Query reaches all four national networks - TEFCA/QHINs, Carequality, CommonWell, and eHealth Exchange.

#### **[ADT Networks](https://www.metriport.com/networks/adt-networks)**

<img src="./assets/platform/adt-networks.png" alt="Admit, transfer, and discharge events from Bamboo Health, Healthix, and PointClickCare plotted along a patient's path from home to the emergency department to inpatient and back home" width="100%" />

Enroll a patient once and their admissions, transfers, and discharges are pushed as they happen, from the national ADT networks (Bamboo Health, PointClickCare) and from state and regional HIEs.

#### **[Pharmacies & Labs](https://www.metriport.com/networks/pharmacies-labs)**

<img src="./assets/platform/pharmacies-labs.png" alt="Surescripts, PBM networks, cash-pay pharmacies, HIEs, and Quest feeding into an RxNorm-coded medication list and LOINC-coded lab results" width="100%" />

Medication fill history & notifications from Surescripts and PBM networks, reconciled onto the record you already query. Lab history & notifications from Quest.

#### **[EHRs](https://www.metriport.com/networks/ehrs)**

<img src="./assets/platform/ehrs.png" alt="Your EHR syncing conditions, medications, allergies, and results into Metriport, with outside records written back into the chart" width="100%" />

Turnkey bi-directional connections to most major EHRs that reconcile internal chart data with everything retrieved from outside it into one interactive longitudinal record.

### **Unified Data Platform**

#### **[Harmonization Engine](https://www.metriport.com/platform/harmonization-engine)**

<img src="./assets/platform/harmonization-engine.png" alt="C-CDA, HL7v2, and scanned PDF inputs passing through harmonization and coming out as a single FHIR R4 bundle" width="100%" />

Work with structured data that’s clean, standardized, and actionable - no matter the format at its source.

#### **[API](https://www.metriport.com/platform/api)**

<img src="./assets/platform/api.png" alt="Your app calling Metriport and receiving consolidated FHIR, webhook events, and ADT feed payloads" width="100%" />

Integrate Metriport into any workflow with a universal FHIR-native API.

#### **[Data Warehouse](https://www.metriport.com/platform/data-warehouse)**

<img src="./assets/platform/data-warehouse.png" alt="C-CDA, FHIR R4, HL7v2, and documents flattened into normalized clinical tables, one table per FHIR resource type" width="100%" />

Run analytical queries via a single unified flattened schema applied across all of your data.

### **Applications**

#### **[Ambient Monitoring & TCM](https://www.metriport.com/applications/ambient-monitoring-tcm)**

<img src="./assets/platform/ambient-monitoring-tcm.png" alt="A patient.discharge event leading to a retrieved patient encounter bundle and same-day follow-up outreach with the discharge summary attached" width="100%" />

Real-time admission, transfer, and discharge events for enrolled patients, with the discharge summary retrieved automatically. The webhook lands in your care-management system with the encounter record already attached, so transition-of-care follow-up starts from context instead of from a search.

#### **[EHR Apps](https://www.metriport.com/applications/ehr-apps)**

<img src="./assets/platform/ehr-apps.png" alt="The Metriport app embedded in an athenahealth chart, showing an AI summary and external medication history with its source network per line" width="100%" />

External patient history rendered inside the chart your clinicians already have open, in EHRs like Epic, athenaOne, Practice Fusion, and Canvas.

#### **[Dashboard & iFrame](https://www.metriport.com/applications/dashboard-iframe)**

<img src="./assets/platform/dashboard-iframe.png" alt="Patient View rendered inside a host application through an embed iframe" width="100%" />

Use our apps standalone, or bake them into your homegrown EHR.

#### **[Messaging](https://www.metriport.com/applications/messaging)**

<img src="./assets/platform/messaging.png" alt="An outbound message carrying a cardiology referral with attachments, routed to another practitioner or to a public health agency as a case report" width="100%" />

Send and receive referrals to other providers, and send electronic case reports to public health agencies.

### **Insights and Analytics**

#### **[Medical Record Summaries](https://www.metriport.com/analytics/medical-record-summaries)**

<img src="./assets/platform/medical-record-summaries.png" alt="A stack of documents summarized into a single AI brief paragraph" width="100%" />

Get an AI summary of the patient information most pertinent to you - thousands of records in a single customizable paragraph.

#### **[Condition Suspecting & Recapture](https://www.metriport.com/analytics/condition-suspecting)**

<img src="./assets/platform/condition-suspecting.png" alt="Observations and medication requests from a longitudinal record producing unconfirmed suspected conditions with ICD-10 codes for review" width="100%" />

Discover conditions that should be presently diagnosed, but are not, based on a patient’s longitudinal medical record.

#### **[Care Gap Identification](https://www.metriport.com/analytics/care-gap-identification)**

<img src="./assets/platform/care-gap-identification.png" alt="A list of open and closed HEDIS measures alongside a MeasureReport showing the population math and the observation that satisfies the numerator" width="100%" />

Find proof of open and closed care gaps with an NCQA certified HEDIS engine.

## **Getting Started**

Check out the links below to get started with Metriport:

### **[Book a Demo](https://www.metriport.com/contact) 📞**

### **[Quickstart Guide](https://docs.metriport.com/medical-api/getting-started/quickstart) 🚀**

### **[Developer Dashboard](https://dash.metriport.com/) 💻**

### **[npm package](https://www.npmjs.com/package/@metriport/api-sdk)**

## **Repo Rundown**

### **API**

Backend for the Metriport platform.

- Dir: [`/packages/api`](/packages/api)
- URL: [https://api.metriport.com/](https://api.metriport.com/)
- Sandbox URL: [https://api.sandbox.metriport.com/](https://api.sandbox.metriport.com/)

### **Infrastructure as Code**

We use AWS CDK as IaC.

- Dir: [`/packages/infra`](/packages/infra)

### **Docs**

Our beautiful developer documentation, powered by [mintlify](https://mintlify.com/) ❤️.

- Dir: [`/docs`](/docs)
- URL: [https://docs.metriport.com/](https://docs.metriport.com/getting-started/introduction)

---

## Contributing

Got ideas for how you can make Metriport better? We welcome community contributions!

#### Contribution guidelines

By making a contribution to this project, you are deemed to have accepted the [Developer Certificate of Origin](https://developercertificate.org/) (DCO), agree to GitHub's [Community Guidelines](https://help.github.com/en/github/site-policy/github-community-guidelines), and agree to the [Acceptable Use Policies](https://help.github.com/en/github/site-policy/github-acceptable-use-policies).

#### Requesting a feature, or reporting a bug

[Click here to open a new issue](https://github.com/metriport/metriport/issues/new/choose) - follow the chosen template and you're good to go.

## **Local Development**

### Monorepo

This monorepo uses [npm workspaces](https://docs.npmjs.com/cli/v9/using-npm/workspaces) to manage the packages and execute commands globally.

But not all folders under `/packages` are part of the workspace. To see the ones that are, check the
root folder's `package.json` under the `workspaces` section.

To setup this repository for local development, issue this command on the root folder:

```shell
$ npm run init # only needs to be run once
$ npm run build # packages depend on each other, so its best to build/compile them all
```

Useful commands:

- `npm run test`: it executes the `test` script on all workspaces;
- `npm run typecheck`: it will run `typecheck` on all workspaces, which checks for typescript compilation/syntax issues;
- `npm run lint-fix`: it will run `lint-fix` on all workspaces, which checks for linting issues and automatically fixes the issues it can;
- `npm run prettier-fix`: it will run `prettier-fix` on all workspaces, which checks for formatting issues and automatically fixes the issues it can;

### Semantic version

This repo uses [Semantic Version](https://semver.org/), and we automate the versioning by using [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

This means all commit messages must be created following a certain standard:

```
<type>[optional scope]: <description>
[optional body]
[optional footer(s)]
```

To enforce commits follow this pattern, we have a Git hook (using [Husky](https://github.com/typicode/husky)) that verifies commit messages according to the Conventional Commits -
it uses [commitlint](https://github.com/conventional-changelog/commitlint) under the hood ([config](https://github.com/conventional-changelog/commitlint/tree/master/@commitlint/config-conventional)).

Accepted types:

- build
- chore
- ci
- docs
- feat
- fix
- perf
- refactor
- revert
- style
- test

Scope is optional, and we can use one of these, or empty (no scope):

- api
- sdk
- infra
- core
- shared
- utils
- scripts
- docs
- ... (usually subdirectories of `./packages`)

The footer should have the issue number supporting the commit:

```
...
Ref: #<issue-number>
```

#### Commitizen

One can enter the commit message manually and have `commitlint` check its content, or use [Commitizen](https://github.com/commitizen/cz-cli)'s
CLI to guide through building the commit message:

```shell
$ npm run commit
```

In case something goes wrong after you prepare the commit message and you want to retry it after fixing the issue, you can issue this command:

```shell
$ npm run commit -- --retry
```

Commitizen will retry the last commit message you prepared previously. More about this [here](https://github.com/commitizen/cz-cli#retrying-failed-commits).

### Security

To avoid pushing secrets to the remote git repository we use [Gitleaks](https://github.com/gitleaks/gitleaks) - triggered by [Husky](https://github.com/typicode/husky).

From their repository:

> Gitleaks is a SAST tool for detecting and preventing hardcoded secrets like passwords, api keys, and tokens in git repos.

It automaticaly scans new commits and interrupts the execution if it finds content that match the configured rules.

Example of report while trying to commit changes:

```shell
> metriport@1.0.0 check-secrets
> docker run --rm -v $(pwd):/path zricethezav/gitleaks:v8.17.0 protect --source='/path' --staged --no-banner -v

Finding:     ...XXXXXXXXX[1;3;mAIXXXXXXXX[0mXXXXXXX/aXXXXXXX...
Secret:      [1;3;mXXXXXXXXXXXXXX[0m
RuleID:      aws-access-token
Entropy:     1.021928
File:        packages/core/src/external/cda/__tests__/examples.ts
Line:        69
Fingerprint: packages/core/src/external/cda/__tests__/examples.ts:aws-access-token:69

[90m2:31AM[0m [32mINF[0m 1 commits scanned.
[90m2:31AM[0m [32mINF[0m scan completed in 141ms
[90m2:31AM[0m [31mWRN[0m leaks found: 1
husky - pre-commit hook exited with code 1 (error)
```

If you're absolutely sure there's no secret on the reported file/line, add the fingerprint to `.gitleaksignore` file - that will be ignored and you'll be able to commit.

### **API Server**

First, create a local environment file to define your developer keys, and local dev URLs:

```shell
$ touch packages/api/.env
$ echo "LOCAL_ACCOUNT_CXID=<YOUR-TESTING-ACCOUNT-ID>" >> packages/api/.env
$ echo "API_URL=http://localhost:8080" >> packages/api/.env
$ echo "FHIR_SERVER_URL=<FHIR-SERVER-URL>" >> packages/api/.env # optional
```

Additionally, define your System Root [OID](https://en.wikipedia.org/wiki/Object_identifier). This will be the base identifier to represent your system in any medical data you create - such as organizations, facilities, patients, and etc.

Your OID must be registered and assigned by HL7. You can do this [here](http://www.hl7.org/oid/index.cfm).

By default, OIDs in Metriport are managed according to the [recommended standards outlined by HL7](http://www.hl7.org/documentcenter/private/standards/v3/V3_OIDS_R1_INFORM_2011NOV.pdf).

```shell
$ echo "SYSTEM_ROOT_OID=<YOUR-OID>" >> packages/api/.env
```

These envs are specific to CommonWell and are necessary in sending requests to their platform.

```shell
$ echo "CW_TECHNICAL_CONTACT_NAME=<YOUR-SECRET>" >> packages/api/.env
$ echo "CW_TECHNICAL_CONTACT_TITLE=<YOUR-SECRET>" >> packages/api/.env
$ echo "CW_TECHNICAL_CONTACT_EMAIL=<YOUR-SECRET>" >> packages/api/.env
$ echo "CW_TECHNICAL_CONTACT_PHONE=<YOUR-SECRET>" >> packages/api/.env
$ echo "CW_GATEWAY_ENDPOINT=<YOUR-SECRET>" >> packages/api/.env
$ echo "CW_GATEWAY_AUTHORIZATION_SERVER_ENDPOINT=<YOUR-SECRET>" >> packages/api/.env
$ echo "CW_GATEWAY_AUTHORIZATION_CLIENT_ID=<YOUR-SECRET>" >> packages/api/.env
$ echo "CW_GATEWAY_AUTHORIZATION_CLIENT_SECRET=<YOUR-SECRET>" >> packages/api/.env
$ echo "CW_MEMBER_NAME=<YOUR-SECRET>" >> packages/api/.env
$ echo "CW_MEMBER_OID=<YOUR-SECRET>" >> packages/api/.env
$ echo "CW_ORG_MANAGEMENT_PRIVATE_KEY=<YOUR-SECRET>" >> packages/api/.env
$ echo "CW_ORG_MANAGEMENT_CERTIFICATE=<YOUR-SECRET>" >> packages/api/.env
$ echo "CW_MEMBER_PRIVATE_KEY=<YOUR-SECRET>" >> packages/api/.env
$ echo "CW_MEMBER_CERTIFICATE=<YOUR-SECRET>" >> packages/api/.env
```

#### **Optional analytics reporting**

The API server reports analytics to [PostHog](https://posthog.com/). This is optional.

If you want to set it up, add this to the `.env` file:

```shell
$ echo "POST_HOG_API_KEY_SECRET=<YOUR-API-KEY>" >> packages/api/.env
```

#### **Optional usage report**

The API server reports endpoint usage to an external service. This is optional.

A reachable service that accepts a `POST` request to the informed URL with the payload below is required:

```json
{
  "cxId": "<the account ID>",
  "cxUserId": "<the ID of the user who's data is being requested>"
}
```

If you want to set it up, add this to the `.env` file:

```shell
$ echo "USAGE_URL=<YOUR-URL>" > packages/api/.env
```

#### **Finalizing setting up the API Server**

Then to run the full back-end stack, use docker-compose to lauch a Postgres container, local instance of DynamoDB, and the Node server itself:

```shell
$ cd packages/api
$ npm run start-docker-compose
```

...or, from the root folder...

```shell
$ npm run start-docker-compose -w api
```

Now, the backend services will be available at:

- API Server: `0.0.0/0:8080`
- Postgres: `localhost:5432`
- DynamoDB: `localhost:8000`

Another option is to have the dependency services running with docker compose and the back-end API running as regular NodeJS process (faster
to run and restart); this has the benefit of Docker Desktop managing the services and you likely only need to start the dependencies once.

```shell
$ cd packages/api
$ npm run start-dependencies # run it once
$ npm run dev
```

#### **Database Migrations**

The API Server uses Sequelize as an ORM, and its migration component to update the DB with changes as the application
evolves. It also uses Umzug for programatic migration execution and typing.

When the application runs it automatically executes all migrations located under `src/sequelize/migrations` (in ascending order)
before the code is atually executed.

NOTE: migrations are run as `.js` on the cloud, and as `.ts` locally - see `packages/api/src/sequelize/index.ts`. This impacts
how we handle migrations AND ROLLBACKS against local DB vs. cloud DB.

If you need to undo/revert a migration manually, you can use the CLI, which is a wrapper to Umzug's CLI (still under heavy
development at the time of this writing).

It requires DB credentials on the environment variable `DB_CREDS` (values from `docker-compose.dev.yml`, update as needed):

```shell
$ export DB_CREDS='{"username":"admin","password":"admin","dbname":"db","engine":"postgres","host":"localhost","port":5432}'
```

Run the CLI with:

```shell
$ cd packages/api
$ npm run db:pending          # list pending migrations
$ npm run db:up               # run all pending migrations
$ npm run db -- down          # revert one migration at a time
$ npm run db -- down --step 2 # revert 2 migrations at a time
```

> Note: the double dash `--` is required so parameters after it go to sequelize cli; without it, parameters go to `npm`

Umzug's CLI is still in development at the time of this writing, so that's how one uses it:

- it will print the commands being sent to the DB
- followed by the result of the command
- it won't exit by default, you need to `ctrl+c`
- the command `up` executes all outstanding migrations
- the command `down` reverts one migration at a time

To create new migrations:

1. Duplicate a migration file on `./packages/api/src/sequelize/migrations`
2. Rename the new file so the timestamp is close to the current time - it must be unique, migrations are executed in sorting order
3. Edit the migration file to perform the changes you want
   - `up` add changes to the DB (takes it to the new version)
   - `down` rolls back changes from the DB (goes back to the previous version)

#### **Additional stuff**

To do basic UI admin operations on the DynamoDB instance, you can do the following:

```shell
$ npm install -g dynamodb-admin # only needs to be run once
$ npm run ddb-admin # admin console will be available at http://localhost:8001/
```

To kill and clean-up the back-end, hit `CTRL + C` a few times, and run the following from the `packages/api` directory:

```shell
$ docker-compose -f docker-compose.dev.yml down
```

To debug the backend, you can attach a debugger to the running Docker container by launching the `Docker: Attach to Node` configuration in VS Code. Note that this will support hot reloads 🔥🔥!

### Utils

The `./packages/utils` folder contains utilities that help with the development of this and other opensource Metriport projects:

- [mock-webhook](https://github.com/metriport/metriport/blob/master/samples/typescript-express/src/mock-webhook.ts): implements the Metriport webhook protocol, can be used by applications integrating with Metriport API as a reference to the behavior expected from these applications when using the webhook feature.
- [fhir-uploader](https://github.com/metriport/metriport/blob/develop/packages/utils/src/fhir-uploader.ts): useful to insert synthetic/mock data from [Synthea](https://github.com/synthetichealth/synthea) into [FHIR](https://www.hl7.org/fhir) servers (see https://github.com/metriport/hapi-fhir-jpaserver).

Check the scripts on the folder's [package.json](https://github.com/metriport/metriport/blob/develop/packages/utils/package.json) to see how to run these.

---

### Tests

Unit tests can be executed with:

```shell
$ npm run test
```

To run integration tests, make sure to check each package/folder README for requirements, but in general they can be
executed with:

```shell
$ npm run test:e2e
```

## **Self-Hosted Deployments**

### **API Key Setup**

Most endpoints require an API Gateway [API Key](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-usage-plans.html).
You can do it manually on AWS console or programaticaly through AWS CLI or SDK.

To do it manually:

1. Login to the AWS console;
1. Go to API Gateway;
1. Create a Usage Plan if you don't already have one;
1. Create an API Key;
   - the `value` field must follow this pattern: base 64 of "`<KEY>:<UUID>`", where:
   - `KEY` is a random key (e.g., generated with `nanoid`); and
   - `UUID` is the customer ID (more about this on [Initialization](#initialization))
1. Add the newly created API Key to a Usage Plan.

Now you can make requests to endpoints that require the an API Key by setting the `x-api-key` header.

### **Environment Setup**

1. Install [AWS CLI](https://aws.amazon.com/cli/) and authenticate with it.

2. You'll need to create and configure a deployment config file: `/infra/config/production.ts`. You can see `example.ts` in the same directory
   for a sample of what the end result should look like. Optionally, you can setup config files for `staging` and `sandbox` deployments, based on
   your environment needs. Then, proceed with the deployment steps below.

3. Install [GNU Parallel](https://www.gnu.org/software/parallel/) to run tests (w/ `npm run test`).

### **Deployment Steps**

1. First, deploy the secrets stack. This will setup the secret keys required to run the server using AWS Secrets Manager and create other infra
   pre-requisites. To deploy it, run the following commands (with `<config.stackName>` replaced with what you've set in your config file):

```shell
$ ./packages/scripts/deploy-infra.sh -e "production" -s "<config.secretsStackName>"
```

2. After the previous steps are done, define all of the required keys in the AWS console by navigating to the Secrets Manager.

3. Then, to provision the infrastructure needed by the API/back-end execute the following command:

```shell
$ ./packages/scripts/deploy-infra.sh -e "production" -s "<config.stackName>"
```

This will create the infrastructure to run the API, including the ECR repository where the API will be deployed at. Take note of that to populate
the environment variable `ECR_REPO_URI`.

4. To provision the IHE Gateway:

Update the `packages/infra/config/production.ts` configuration file, populating the properties under
`iheGateway` with the information from the respective resources created on the previous step
(API Stack).

Execute:

```shell
$ ./packages/scripts/deploy-infra.sh -e "production" -s "IHEStack"
```

This will create the infrastructure to run the IHE Gateway.

5. To deploy the API on ECR and restart the ECS service to make use of it:

```shell
$ AWS_REGION=xxx ECR_REPO_URI=xxx ECS_CLUSTER=xxx ECS_SERVICE=xxx ./packages/scripts/deploy-api.sh"
```

where:

- ECR_REPO_URI: The URI of the ECR repository to push the Docker image to (created on the previous step)
- AWS_REGION: The AWS region where the API should be deployed at
- ECS_CLUSTER: The ARN of the ECS cluster containing the service to be restarted upon deployment
- ECS_SERVICE: The ARN of the ECS service to be restarted upon deployment

After deployment, the API will be available at the configured subdomain + domain.

Note: if you need help with the `deploy-infra.sh` script at any time, you can run:

```shell
$ ./packages/scripts/deploy-infra.sh -h
```

## License

Distributed under the AGPLv3 License. See `LICENSE` for more information.

Copyright © Metriport 2022-present
