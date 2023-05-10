# API Server

### Tests

Unit tests can be executed with:

```shell
$ npm run test
```

To run integration tests, first have these services running local, each with its own dependencies:

- API server
- FHIR Server

Set this environment variable on your local `.env` file with a valid API key from your local environment:

```shell
$ echo "API_KEY=XXXXXXXX" >> .env
```

Then execute integration tests with:

```shell
$ npm run test:e2e
```
