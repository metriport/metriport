# API Server

### Tests

Unit tests can be executed with:

```shell
$ npm run test
```

To run integration tests, first have these services running local, each with its own dependencies:

- API server
- FHIR Server

Then execute integration tests with:

```shell
$ npm run test:e2e
```
