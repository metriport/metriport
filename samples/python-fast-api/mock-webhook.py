import hmac
import hashlib
import json
from fastapi import FastAPI, Request, Response, status
from pydantic import BaseModel

import gcp
from create_patient_trigger_webhook import post_consolidated_query, default_async_client

# Initialize FastAPI app
app = FastAPI()
# Get environment variables
gcp_instance = gcp.GCP()
WH_KEY = gcp_instance.get_secret("METRIPORT_WH_KEY")
PATIENT_ID = gcp_instance.get_secret("METRIPORT_PATIENT_ID")

# Function to verify webhook signature
def verify_webhook_signature(key, message, signature, digestmod=hashlib.sha256):
    """
    Verify the HMAC signature for a given message and key.

    :param key: The secret key (string).
    :param message: The message to be authenticated (string in JSON format).
    :param signature: The provided HMAC signature to verify against (string).
    :param digestmod: The hash function to use (defaults to hashlib.sha256).
    :return: True if signature is verified, False otherwise.
    """

    message_bytestring = json.dumps(message, separators=(',', ':')).encode()  # Convert the message string to bytes
    key_bytestring = key.encode()  # Convert the key string to bytes
    hmac_object = hmac.new(key_bytestring, message_bytestring, digestmod)
    computed_signature = hmac_object.hexdigest()
    return signature == computed_signature

class WebhookPayload(BaseModel):
    ping: str = None


@app.post("/")
async def webhook(request: Request):
    """
    This Python function handles a webhook request by verifying the signature, processing different
    types of webhook events, and returning an appropriate response. It assumes you only have one patient
    whose id is queried from the environment variable METRIPORT_PATIENT_ID. The application flow here is 
    the following:
    Webhook gets triggered by doucment query request, and once it recieves a document-conversion in the response,
    it makes a consolidated query request. Once it recieves a consolidated-data in the response, it "saves" the
    data to BigQuery.

    :param request: The request object.
    :return: A response object.
    """
    body = await request.json()
    signature = request.headers.get('x-metriport-signature')

    print(json.dumps(body, indent=2))
    
    if verify_webhook_signature(WH_KEY, body, signature):
        print('Signature verified')
    else:
        print('Signature verification failed')

    if 'ping' in body:
        print('Sending 200 | OK + "pong" body param')
        return Response(content=json.dumps({'pong': body['ping']}), media_type="application/json", status_code=status.HTTP_200_OK)
    

    # Check the type of the webhook
    webhook_type = body.get('meta', {}).get('type')

    if webhook_type == 'medical.document-download':
        # Do nothing
        print("Documents Downloaded")
        pass
    elif webhook_type == 'medical.document-conversion':
        # Perform a consolidated query
        print("Making Consolidated Query")
        consolidated_query_response = await post_consolidated_query(
            patient_id=PATIENT_ID,
            client=default_async_client(),
        )

    elif webhook_type == 'medical.consolidated-data':
        # Save the results to BigQuery
        print("Writing to Big Query")
        gcp_instance.save_to_big_query(body['patients'][0]['bundle']['entry'])


    print('Sending 200 | OK')
    return Response(status_code=status.HTTP_200_OK)


