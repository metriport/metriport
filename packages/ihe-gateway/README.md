# IHE Gateway

The Metriport IHE Gateway is a service that allows for healthcare information exchange using standardized IHE profiles.

## Setup

### Custom Extensions

To include customer extensions, add the zip files to a `custom-extensions` folder:

```shell
$ mkdir ./custom-extensions
```

If you do add extensions, make sure to add a license key to a `.env` file:

```shell
$ touch .env
$ echo "LICENSE_KEY=<YOUR-LICENSE-KEY>" >> .env
```

### Launch

To start the gateway, you can use `docker-compose`:

```shell
$ docker-compose start
```
