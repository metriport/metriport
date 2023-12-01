### Metriport <> Node Fast API

### Instructions to setup

- `cd node-fast-api`
- `npm i`
- `touch .env`
- Set environment variables in `.env` file (see `.env.example`).

## Run the mock-webhook Fast API

- `npm run mock-webhook`
- `ngrok http 8088`
- copy and paste the ngrok url into your dashboard and copy the metriport_wh_key into your .env to test.

## Create a patient and trigger a webhooks

- `npm run start`
