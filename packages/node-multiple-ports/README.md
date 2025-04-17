# Metriport Utils: Node listening to multiple ports

Metriport's util to build a docker container that listens to multiple ports and respond a simple 200 +
payload indicating the port being executed.

Upon execution it logs:

```shell
Listening on port 8080...
Listening on port 8443...
Listening on port 8081...
...
```

Upon request on port `8080` it logs:

```shell
Got a request on port 8080 - GET /
```

...and responds:

```json
{
  "port": 8080,
  "method": "GET",
  "path": "/",
  "status": "OK"
}
```

## Useful commands

- `npm start` runs the server as a Node process
- `docker compose -f docker-compose.yml up --build` build and run the server as a docker container
  (remove `--build` to run it without building)
- `./deploy.sh` publishes the docker container on ECR and triggers a restart on a ECS service - required env vars:
  - `AWS_REGION` the aws region
  - `ECR_REPO_URI` the ECR repo URI
  - `ECS_CLUSTER` the ECS cluster ARN
  - `IHE_OUTBOUND_ECS_SERVICE` the ECS service ARN of the outbound instance
  - `IHE_INBOUND_ECS_SERVICE` the ECS service ARN of the outbound instance
