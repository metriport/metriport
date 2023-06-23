# FHIR Test

Tests to validate two base implementations of FHIR servers:

- [HAPI FHIR JPA Server](https://github.com/hapifhir/hapi-fhir-jpaserver-starter)
- [Medplum](https://github.com/medplum/medplum)

It's based on [Artillery](https://www.artillery.io/) and publishes metrics on [AWS Cloudwatch](https://aws.amazon.com/cloudwatch/).

### Getting Started

Install Artillery globally, if not installed already:

```shell
$ npm i artillery -g
```

Install dependencies:

```shell
$ npm i
```

Set environment variables or store them on a `.env` file (see `.env.example`).

The tests included here are load tests, meaning they'll execute hundreds/thousands of requests to the chosen server.

Batch tests will execute a tens/lower hundred tests, because of the nature of the batch inserting a lot of data.

Run desired test (this one runs load testing for HAPI, loading env vars from a `.env` file):

```shell
$ artillery run --dotenv .env src/healthcheck-medplum.yml
```

To run batch tests, first store FHIR Bundles in JSON format under the `src/fhir/batch/load` - tests will pick a file for
each request randomly. We suggest to insert similar sized files and run enough iterations so that the conditions are
statistically similar between the servers.

To see detailed information about requests/responses, set an env var:

```shell
$ DEBUG=http:response artillery run --dotenv .env src/healthcheck-medplum.yml
```

To store the result of the tests on a file:

```shell
$ artillery run --dotenv .env --output test-run-report.json src/healthcheck-medplum.yml
```

And to generate a report in HTML:

```shell
$ artillery report test-run-report.json
```
