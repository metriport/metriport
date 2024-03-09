# IHE Gateway

The Metriport IHE Gateway (IHE GW) is a service that allows REST based systems to communicate with
Healthcare Information Exchanges (HIEs) using standardized IHE profiles.

It's based on Mirth Connect: https://github.com/nextgenhealthcare/connect

## Setup

### Requirements

Initialize the `.env` file accordingly, can use the `.env.example` as reference, or the one on the
password manager for quick setup if avaliable:

```shell
$ touch .env
```

Note: `IHE_GW_FULL_BACKUP_LOCATION` should point to the folder where you want to store the full
backup of the IHE Gateway. It's advised to store it on a different place as it contains sensitive
information (e.g., SSL/Java keystore private key).

### Initialization

Initialize the repository with the command below; it will download required files from S3:

```shell
$ ./scripts/init.sh
```

To initialize to a specific environment, set the environment variable `ENV_TYPE`:

```shell
$ ENV_TYPE=production ./scripts/init.sh
```

To build the server container for the first time, run the command below, which will spin up the
IHE GW as well as a Postgres instance:

```shell
$ ./scripts/run-docker.sh --build
```

### Custom Extensions

To include custom extensions, add the zip files to a `config/custom-extensions` folder:

```shell
$ mkdir ./config/custom-extensions
```

If you do add extensions, you might need to add a license key to a `.env` file:

```shell
$ touch .env
$ echo "LICENSE_KEY=<YOUR-LICENSE-KEY>" >> .env
```

### Launch

In subsequent runs, you can use the script below - or just run it from Docker Desktop:

```shell
$ ./scripts/run-docker.sh
```

### Administrator

To open Administrator windows connected to each task on the cloud, run one of the commands below,
depending to which type of instance you want to connect to:

```shell
$ npm run admin -- outbound
$ npm run admin -- inbound
$ npm run admin -- all
```

### Development

Make sure to have the `.env` file initialized. See `.env.example` for more details.

:warning: The commands below will overwrite the destination (either local config files or server
configs).

To pull configs and backup from the server:

```shell
$ ./scripts/pull-from-server.sh
```

To push configs and backup to the server (after you pulled from Git remote, for example):

```shell
$ ./scripts/push-to-server.sh
```

Configs are stored in the Docker image.

#### Build-time

When we're building the container image, we need the env vars and scripts below.

Notable env vars:

- IHE_GW_KEYSTORE_STOREPASS
- IHE_GW_KEYSTORE_KEYPASS
- IHE_GW_FULL_BACKUP_LOCATION

Scripts:

- init.sh
- load-env.sh (needed local, runs on all envs)
- build-docker-dependencies.sh
- deploy-ihe-gw.sh
- run-docker.sh

#### Runtime

When we're running the container, we need the env vars and scripts below.

This happens local when we call `run-docker.sh` or in the cloud when ECS spins up a new
service task.

Notable env vars:

- ADMIN_USER
- ADMIN_PASSWORD
- IHE_GW_URL (only for push-to-server and pull-from-server)
- IHE_GW_FULL_BACKUP_LOCATION (only for pull-from-server)

Scripts:

- entrypoint.sh
- load-env.sh
- push-to-server.sh
- pull-from-server.sh (local only)
- run-docker.sh (local only)
