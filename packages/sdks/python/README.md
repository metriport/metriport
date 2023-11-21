## Local Python SDK 

The python project uses the locally fern generated Python SDK 
and runs tests against the Metriport API. 

To run the tests, run the following commands
```bash
# Run cd packages/sdks/python 
poetry install 
python main.py
```

Install the pylance and mypy plugins to get code completion
in your editor.

### Regenerating the Python SDK

To update the generated Python SDK, run 
```bash
fern generate --group test
```
