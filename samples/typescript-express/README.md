### Metriport <> Typescript Express API

### Instructions to setup

- `cd typescript-express`
- `npm i`
- `touch .env`
- Set environment variables in `.env` file (see `.env.example`).

## Run the mock-webhook API

- `npm run mock-webhook`
- `ngrok http 8088`
- copy and paste the ngrok url into your dashboard and copy the metriport_wh_key into your .env to test.

## Create a patient and trigger a webhooks

- `npm run start`
