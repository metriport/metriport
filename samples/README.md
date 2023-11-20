###

- Make sure you have python 3.10.4 installed

### Instuctions to run

- `python3 -m venv env`
- `source env/bin/activate`
- `pip install -r samples/requirements.txt`

## Run mock-webhook

- `uvicorn main:app --reload --port 8088`
- `ngrok http 8088`
- copy and paste the ngrok url into your dashboard and copy the metriport_wh_key into your .env to test.

###

- Removed once stuff since seems to be a custom package?
