# IHE Gateway

The Metriport IHE Gateway (IHE GW) is a service that allows REST based systems to communicate with
Healthcare Information Exchanges (HIEs) using standardized IHE profiles.

It's based on Mirth Connect: https://github.com/nextgenhealthcare/connect

## Setup

### Requirements

Initialize the `.env` file accordingly, can use the `.env.example` as reference, or the one on the password
manager for quick setup:

```shell
$ touch .env
```

### Initialization

Initialize the repository with the command below; it will download required files from S3:

```shell
$ ./scripts/init.sh
```

To build the server container for the first time, run the command below, which will spin up the
IHE GW as well as a Postgres instance:

```shell
$ docker-compose -f docker-compose.yml up --build
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

In subsequent runs, you can use docker-compose start - or just run it from Docker Desktop:

```shell
$ docker-compose start
```

### Development

Make sure to have the `.env` file initialized. See `.env.example` for more details.

Note: `IHE_GW_FULL_BACKUP_LOCATION` should point to the folder where you want to store the full
backup of the IHE Gateway. It's advised to store it on a different place as it contains sensitive
information (e.g., SSL/Java keystore private key).

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
