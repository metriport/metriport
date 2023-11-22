# IHE Server

### Dev Setup

Docker containers started with:

```shell
$ docker-compose start
```

For any custom extensions you want to include, add the zip files to the `custom-extensions` folder.

If you do add extensions make sure to add a license key:

```shell
$ touch .env
$ echo "LICENSE_KEY=<YOUR-LICENSE-KEY>" >> .env
```
