# Metriport API and Webhook Sample

To run this sample, you need to have an API key and a webhook key.

Go to the [Metriport Dashboard](https://dashboard.metriport.com) to get them. See our
[quickstart guide](https://docs.metriport.com/medical-api/getting-started/quickstart#1-create-a-developer-account)
to learn how to setup your account (create an API key and Facility).

Make sure you have python 3.10.4 installed.

You're also going to need a reverse proxy. This guide uses [ngrok](https://ngrok.com/), but you can
use any other service that provides a public URL for your local machine.

## Instructions to setup

- `cd samples/python-fast-api`
- `python3 -m venv env`
- `source env/bin/activate`
- `pip install -r requirements.txt`

## Run the mock-webhook API

- Open a terminal and run `uvicorn mock-webhook:app --reload --port 8088`
- Open another terminal and run your reverse proxy (e.g. `ngrok http 8088`)
- Copy and paste the reverse proxy url into your dashboard (Developers > Webhook > URL) and
  click "Save and Test"
- You should get the "ping" request on the first terminal
- Still on the Dashboard, copy the Webhook key and store it into your `.env` file

## Create a patient and trigger a webhook request

- Open a new terminal and run python3 -m create_patient_trigger_webhook`
- You should get a `medical.document-download` request on the first terminal (where you ran the
  mock-webhook command)
