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
   $ npm run build
   ```
1. Follow the deployment process of the monorepo (`/infra`)

After running `prep-deploy` you might want to run `npm i` to install dev dependencies again - especially
`chromium` which is installed as a dev dependency because it's available for lambdas as a layer.
