## Local Python SDK 

The python project uses the locally fern generated Python SDK 
and runs tests against the Metriport API. 

### Regenerating the Python SDK

To update the generated Python SDK locally for testing, run 
```bash
fern generate --group test
```
You will be proped to sign in. Do this. 

To run the tests, run the following commands
```bash
poetry install 
pip install -r requirements.txt
poetry run pytest tests
```

Install the pylance and mypy plugins to get code completion
in your editor.

