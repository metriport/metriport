###

- Make sure you have python 3.10.4 installed

### Instuctions to setup

- `python3 -m venv env`
- `source env/bin/activate`
- `pip install -r samples/requirements.txt`

## Run the mock-webhook Fast API

- `cd python-fast-api`
- `uvicorn mock-webhook:app --reload --port 8088`
- `ngrok http 8088`
- copy and paste the ngrok url into your dashboard and copy the metriport_wh_key into your .env to test.

## Create a patient and trigger a webhook

- `python3 -m create_patient_trigger_webhook`
