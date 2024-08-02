Guide to Setting Up Canvas Notification Protocol

```bash
cd canvas
python3 -m venv myenv
pip install canvas-workflow-kit
canvas-cli create-default-settings
vim ~/.canvas/config.ini

```

And then modify the file with the following. Our testing environment is "metriport-sandbox"

```markdown
[environment-name]
url=https://{environment}.canvasmedical.com/
api-key={your_api_key_here}
is_default=true
```

Now we can upload our protocol

```bash
canvas-cli upload "./canvas_protocols/appointment_event.py"
```

Now we need to set variables in the Canvas UI. Go to https://{environment}.canvasmedical.com/admin/api/protocolsetting/
and set the following variables with appropriate values:

CLIENT_ID
CLIENT_SECRET

METRIPORT_CX_ID
METRIPORT_FACILITY_ID
METRIPORT_API_KEY

The CLIENT_ID and CLIENT_SECRET can be found from following this tutorial https://docs.canvasmedical.com/api/customer-authentication/
