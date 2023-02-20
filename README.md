<p align="center">
  <a href="https://github.com/metriport/metriport">
    <img src="./assets/logo.png" alt="Logo">
  </a>

  <p align="center">
    Metriport helps digital health companies access and manage health and medical data, through a single open source API.
    <br />
    <a href="https://metriport.com" target="_blank"><strong>Learn more »</strong></a>
    <br />
    <br />
    <a href="https://docs.metriport.com/" target="_blank">Docs</a>
    ·
    <a href="https://www.npmjs.com/package/@metriport/api" target="_blank">NPM</a>
    ·
    <a href="https://dash.metriport.com" target="_blank">Developer Dashboard</a>
    ·
    <a href="https://metriport.com" target="_blank">Website</a>

  </p>
</p>

<p align="center">
   <a href="https://metriport.statuspage.io/"><img src="https://img.shields.io/badge/status-up-green" alt="Uptime"></a>
   <a href="https://github.com/metriport/metriport/stargazers"><img src="https://img.shields.io/github/stars/metriport/metriport" alt="Github Stars"></a>
   <a href="https://github.com/metriport/metriport/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-AGPLv3-purple" alt="License"></a>
   <a href="https://github.com/metriport/metriport/pulse"><img src="https://img.shields.io/github/commit-activity/m/metriport/metriport" alt="Commits-per-month"></a>
   <a href="https://twitter.com/metriport"><img src="https://img.shields.io/twitter/follow/metriport?style=social"></a>
   <a href="https://www.linkedin.com/company/metriport"><img src="https://img.shields.io/static/v1?label=LinkedIn&message=Metriport (YC S22)&color=blue" alt="LinkedIn"></a>
   <a href="https://www.ycombinator.com/companies/metriport"><img src="https://img.shields.io/static/v1?label=Y Combinator&message=Metriport&color=orange" alt="YC"></a>
</p>

<div align="center">

#### Support us on [Product Hunt](https://www.producthunt.com/products/metriport-api) and [Launch YC](https://www.ycombinator.com/launches/Ghx-metriport-universal-api-for-healthcare-data)

<a href="https://www.producthunt.com/posts/metriport-health-devices-api?utm_source=badge-featured&utm_medium=badge&utm_souce=badge-metriport&#0045;health&#0045;devices&#0045;api" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=371762&theme=light" alt="Metriport&#0032;&#0045;&#0032;Health&#0032;Devices&#0032;API - Open&#0045;source&#0032;Plaid&#0032;for&#0032;healthcare&#0032;data | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a> <a href='https://www.ycombinator.com/launches/Ghx-metriport-universal-api-for-healthcare-data' target="_blank"><img src='https://www.ycombinator.com/launches/Ghx-metriport-universal-api-for-healthcare-data/upvote_embed.svg' alt='Launch YC: Metriport - Universal API for Healthcare Data'></a>

</div>

## **Overview**

<div align="center">
   <img width="50%" alt="wearables" src="./assets/wearables.svg">
</div>

## **Security and Privacy**

Metriport is SOC 2 and HIPAA compliant. [Click here](https://metriport.com/security/) to learn more about our security practices.

<p float="left">
  <img src="./assets/soc2.png" width="20%" />
  <img src="./assets/hipaa.png" width="30%" />
  <img src="./assets/soc2-vanta.png" width="20%" />
  <img src="./assets/hipaa-vanta.png" width="20%" />
</p>

### **Health Devices API**

Our [Health Devices API](https://metriport.com/devices), allows you to gain access to your users’ health data from various wearables, RPM devices, and mHealth sources through a single standardized API.

Out of the box, our Health Devices API supports the following integrations:

- Fitbit
- Garmin
- Oura
- Whoop
- Withings
- Cronometer
- Apple Health
- Google Fit

...with many more integrations on the way! If there’s an integration you need that’s not currently on here, feel free to shoot us an [email](mailto:contact@metriport.com) and let us know so we can build it, or feel free to fork our code and add the integration yourself.

<div align="center">
   <img width="50%" alt="wearables" src="./assets/graphic.svg">
</div>

### **Medical API (Coming Soon)**

Open-source with native FHIR support. More info on our Medical API here: https://metriport.com/medical/

## **Getting Started**

Check out the links below to get started with Metriport in minutes!

### **[Quickstart Guide](https://docs.metriport.com/getting-started/introduction) 🚀**

### **[Developer Dashboard](https://dash.metriport.com/) 💻**

### **[npm package](https://www.npmjs.com/package/@metriport/api)**

## **Repo Rundown**

### **API Server**

Backend for the Metriport API.

- Dir: [`/api`](/api)
- URL: [https://api.metriport.com/](https://api.metriport.com/)
- Sandbox URL: [https://api.sandbox.metriport.com/](https://api.sandbox.metriport.com/)

### **Connect Widget**

Pre-built app that you can embed your own app! Use it to allow your users to authenticate with various data sources, allowing you to pull their health data from those sources.

<div align="left">
   <img width="50%" alt="connect widget" src="https://i.ibb.co/mNgMwyd/Screenshot-2022-12-20-at-3-51-47-PM.png">
</div>

- Dir: [`/connect-widget`](/connect-widget)
- URL: [https://connect.metriport.com/](https://connect.metriport.com/?token=demo)

### **Infrastructure as Code**

We use AWS CDK as IaC.

- Dir: [`/infra`](/infra)

### **Docs**

Our beautiful developer documentation, powered by [mintlify](https://mintlify.com/) ❤️.

- Dir: [`/docs`](/docs)
- URL: [https://docs.metriport.com/](https://docs.metriport.com/getting-started/introduction)

### **Packages**

Checkout our packages in [`/pkgs`](/pkgs) to help you turbocharge your development:

#### **npm**

Our npm packages are available in [`/packages`](/packages):

- [Metriport API](/packages/packages/api/): contains the Metriport data models, and a convenient API client wrapper.
- [CommonWell JWT Maker](/packages/packages/commonwell-jwt-maker/): CLI to create a JWT for use in [CommonWell](https://www.commonwellalliance.org/) queries.
- [CommonWell SDK](/packages/packages/commonwell-sdk/): SDK to simplify CommonWell API integration.

#### **iOS**

Our iOS packages are available in our [`iOS repo`](https://github.com/metriport/metriport-ios-sdk):

- [Metriport iOS](https://github.com/metriport/metriport-ios-sdk): SDK to integrate with the Metriport Connect Widget and Apple Health on iOS.

### **Code Examples**

Some example projects that serve as examples for how to integrate with Metriport on various platforms - such as iOS and Android.

- Dir: [`/examples`](/examples)

---

## **Prerequisites**

Before getting started with the deployment or any development, ensure you have done the following:

1. Install the prerequisite programs:
   - [The latest LTS Node.js version](https://nodejs.org/en/download/).
   - [Docker Desktop](https://www.docker.com/products/docker-desktop/).
   - (Optional) [VS Code](https://code.visualstudio.com/) - recommended IDE.
   - (Optional) [DBeaver](https://dbeaver.io/) - recommended universal DB tool.
2. Create an AWS account.
3. Create an [AWS IAM admin user](https://docs.aws.amazon.com/IAM/latest/UserGuide/getting-started_create-admin-group.html).
4. Setup AWS `Route 53` to [handle the DNS for your domain, and create a hosted zone](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/migrate-dns-domain-inactive.html).
5. Follow modules 1 & 2 of [this guide](https://aws.amazon.com/getting-started/guides/setup-cdk/) for `Typescript` to bootstrap the `AWS CDK` on your local machine.
6. 🥳 🎉 🥳 🎉 🥳 🎉

## **Local Development**

### Monorepo

This monorepo uses [npm workspaces](https://docs.npmjs.com/cli/v9/using-npm/workspaces) to manage the packages and execute commands globally.

To setup this repository for local development, issue this command on the root folder:

```shell
$ npm install # only needs to be run once
```

Useful commands:

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
- widget
- infra

The footer should have the ticket number supporting the commit:

```
...
Ref: #<ticket-number>
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

### **API Server**

First, create a local environment file to define your developer keys, and local dev URLs:

```shell
$ touch api/app/.env
$ echo "API_URL=http://localhost:8080" >> api/app/.env
$ echo "CONNECT_WIDGET_URL=http://localhost:3001/" >> api/app/.env
$ echo "CRONOMETER_CLIENT_ID=<YOUR-ID>" >> api/app/.env
$ echo "CRONOMETER_CLIENT_SECRET=<YOUR-SECRET>" >> api/app/.env
$ echo "FITBIT_CLIENT_ID=<YOUR-KEY>" >> api/app/.env
$ echo "FITBIT_CLIENT_SECRET=<YOUR-SECRET>" >> api/app/.env
$ echo "GARMIN_CONSUMER_KEY=<YOUR-KEY>" >> api/app/.env
$ echo "GARMIN_CONSUMER_SECRET=<YOUR-SECRET>" >> api/app/.env
$ echo "GOOGLE_CLIENT_ID=<YOUR-KEY>" >> api/app/.env
$ echo "GOOGLE_CLIENT_SECRET=<YOUR-SECRET>" >> api/app/.env
$ echo "OURA_CLIENT_ID=<YOUR-KEY>" >> api/app/.env
$ echo "OURA_CLIENT_SECRET=<YOUR-SECRET>" >> api/app/.env
$ echo "WHOOP_CLIENT_ID=<YOUR-KEY>" >> api/app/.env
$ echo "WHOOP_CLIENT_SECRET=<YOUR-KEY>" >> api/app/.env
$ echo "WITHINGS_CLIENT_ID=<YOUR-SECRET>" >> api/app/.env
$ echo "WITHINGS_CLIENT_SECRET=<YOUR-SECRET>" >> api/app/.env
$ echo "SYSTEM_ROOT_OID=<YOUR-OID>" >> api/app/.env
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
$ echo "USAGE_URL=<YOUR-URL>" > api/app/.env
```

#### **Finalizing setting up the API Server**

Then to run the full back-end stack, use docker-compose to lauch a Postgres container, local instance of DynamoDB, and the Node server itself:

```shell
$ cd api/app
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

#### **Database Migrations**

The API Server uses Sequelize as an ORM, and its migration component to update the DB with changes as the application
evolves. It also uses Umzug for programatic migration execution and typing.

When the application runs it automatically executes all migrations located under `src/sequelize/migrations` (in ascending order)
before the code is atually executed.

If you need to undo/revert a migration manually, you can use the CLI, which is a wrapper to Umzug's CLI (still under heavy
development at the time of this writing).

It requires DB credentials on the environment variable `DB_CREDS` (values from `docker-compose.dev.yml`, update as needed):

```shell
$ export DB_CREDS='{"username":"admin","password":"admin","dbname":"db","engine":"postgres","host":"localhost","port":5432}'
```

Run the CLI with:

```shell
$ npm i -g ts-node # only needs to be run once
$ cd api/app
$ ts-node src/sequelize/cli
```

Umzug's CLI is still in development at the time of this writing, so that's how one uses it:

- it will print the commands being sent to the DB
- followed by the result of the command
- it won't exit by default, you need to `ctrl+c`
- the command `up` executes all outstanding migrations
- the command `down` reverts one migration at a time

To create new migrations:

1. Duplicate a migration file on `./api/app/src/sequelize/migrations`
2. Rename the new file so the timestamp is close to the current time - it must be unique, migrations are executed in sorting order
3. Edit the migration file to perform the changes you want
   - `up` add changes to the DB (takes it to the new version)
   - `down` rolls back changes from the DB (goes back to the previous version)

#### **Additional stuff**

To do basic UI admin operations on the DynamoDB instance, you can do the following:

```shell
$ npm install -g dynamodb-admin # only needs to be run once
$ DYNAMO_ENDPOINT=http://localhost:8000 dynamodb-admin # admin console will be available at http://localhost:8001/
```

To kill and clean-up the back-end, hit `CTRL + C` a few times, and run the following from the `api/app` directory:

```shell
$ docker-compose -f docker-compose.dev.yml down
```

To debug the backend, you can attach a debugger to the running Docker container by launching the `Docker: Attach to Node` configuration in VS Code. Note that this will support hot reloads 🔥🔥!

### **Connect Widget**

To run the Connect Widget:

```shell
$ cd connect-widget/app
$ npm run start # available on port 3001 by default
```

...or, from the root folder...

```shell
$ npm run start -w connect-widget
```

To debug the Connect Widget, you can attach a run a Chrome window by launching the `Run Chrome` configuration in VS Code.

### Utils

The `./utils` folder contains utilities that help with the development of this and other opensource Metriport projects:

- [mock-webhook](https://github.com/metriport/metriport/blob/develop/utils/src/mock-webhook.ts): implements the Metriport webhook protocol, can be used by applications integrating with Metriport API as a reference to the behavior expected from these applications when using the webhook feature.
- [fhir-uploader](https://github.com/metriport/metriport/blob/develop/utils/src/fhir-uploader.ts): useful to insert synthetic/mock data from [Synthea](https://github.com/synthetichealth/synthea) into [FHIR](https://www.hl7.org/fhir) servers (see https://github.com/metriport/hapi-fhir-jpaserver).

Check the scripts on the folder's [package.json](https://github.com/metriport/metriport/blob/develop/utils/package.json) to see how to run these.

---

## **Self-Hosted Deployments**

### **API Key Setup**

TODO

### **Environment Setup**

1. You'll need to create and configure a deployment config file: `/infra/config/production.ts`. You can see `example.ts` in the same directory for a sample of what the end result should look like. Optionally, you can setup config files for `staging` and `sandbox` deployments, based on your environment needs. Then, proceed with the deployment steps below.

2. Configure the Connect Widget environment variables to the subdomain and domain you'll be hosting the API at in the config file: `connect-widget/app/.env.production`.

### **Deployment Steps**

1. First, deploy the secrets stack. This will setup the secret keys required to run the server using AWS Secrets Manager. To deploy it, run the following commands (with `<config.stackName>` replaced with what you've set in your config file):

```shell
$ ./deploy.sh -e "production" -s "<config.secretsStackName>"
```

2. After the previous steps are done, define all of the required keys in the AWS console by navigating to the Secrets Manager.

3. Then, to deploy the back-end execute the following command:

```shell
$ ./deploy.sh -e "production" -s "<config.stackName>"
```

After deployment, the API will be available at the configured subdomain + domain.

4. Finally, to self-host the Connect widget, run the following:

```shell
$ ./deploy.sh -e "production" -s "<config.connectWidget.stackName>"
```

Note: if you need help with the `deploy.sh` script at any time, you can run:

```shell
$ ./deploy.sh -h
```

## License

Distributed under the AGPLv3 License. See `LICENSE` for more information.

Copyright © Metriport 2022-present
