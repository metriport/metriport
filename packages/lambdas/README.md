# Lambdas

## Description

Lambdas to support Metriport's platform.

Install packages:

```shell
$ npm i
```

## Deployment Process

The lambdas are currently deployed automatically along the APIStack when we merge PRs on GitHub - using GH Actions.

To deploy locally:

1. Prepare the shared lambda layer (containing the lambdas' `node_modules`)
   ```shell
   $ npm prep-deploy
   ```
1. Compile TS into JS
   ```shell
   $ npm i
   $ npm run build
   ```
1. Follow the deployment process of the monorepo (`/infra`)

After running `prep-deploy` you might want to run `npm i` to install dev dependencies again - especially
`chromium` which is installed as a dev dependency because it's available for lambdas as a layer.

## Testing

This package is setup to run Jest unit tests. They're stored on the respective folder under `./__tests__/`.

> ⚠️ Don't store test values on `.env.test` - create a local version instead.

Jest is configured to use the `.env.test` file for environment variables so it can run on CI/CD. The variables
on that file are present only so `getEnvVarOrFail` doesn't throw preventing the tests from running.

If you need to store env vars for your local tests, do so by creating a clone of that file, called `.env` (it
should not be added to Git!).
