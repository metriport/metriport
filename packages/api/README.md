# API Server

### Tests

Unit tests can be executed with:

```shell
$ npm run test
```

To run E2E (end-to-end) tests, first have these services running local, each with its own dependencies:

```shell
$ npm run start-dependencies
```

...or, in case you're running the API also as a Docker container:

```shell
$ npm run start-docker-compose
```

Set this environment variable on your local `.env` file with valid API and Webhook keys from your local environment (from the Dash's Developer settings):

```shell
$ echo "TEST_API_KEY=XXXXXXXX" >> .env
$ echo "WH_KEY=XXXXXXXX" >> .env
```

Then execute E2E tests on a different terminal (keep the API running on another terminal) with:

```shell
$ npm run test:e2e
```

To run a specific test/group:

```shell
npm run test:e2e -- -t 'MAPI E2E Tests'
```
