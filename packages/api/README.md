# API Server

### Tests

Unit tests can be executed with:

```shell
$ npm run test
```

To run E2E (end-to-end) tests, first have these services running local, each with its own dependencies:

- API server
- FHIR Server

Set this environment variable on your local `.env` file with a valid API key from your local environment:

```shell
$ echo "TEST_API_KEY=XXXXXXXX" >> .env
```

Then execute E2E tests with:

```shell
$ npm run test:e2e
```

To run a specific test/group:

```shell
npm run test:e2e -- -t 'MAPI E2E Tests'
```
