## Local Python SDK 

The python project uses the locally fern generated Python SDK 
and runs tests against the Metriport API. 

### Setup

1. Create a `.env` file with your environment variables:
```bash
API_KEY=<your_api_key>
FACILITY_ID=<your_facility_id>
PATIENT_ID=<your_patient_id>
BASE_URL=http://localhost:8080
```


2. Install dependencies:
```bash
poetry lock
poetry install
```

### Regenerating the Python SDK

To update the generated Python SDK locally for testing, run 
```bash
fern generate --group test
```
You will be prompted to sign in. 

### Running the Tests

**Note:** Make sure the Metriport API server is running locally (see main README for setup instructions).

Run all tests:
```bash
poetry run pytest tests -v
```

Run a specific test:
```bash
poetry run pytest tests/test_create_patient.py -v
```

### Publishing SDK Changes to PyPI

When you're ready to publish a new version of the SDK to PyPI, follow these steps:

#### 1. Update pyproject.toml

Update the `[tool.poetry]` section with the new version and package configuration:

```toml
[tool.poetry]
name = "metriport"
version = "X.Y.Z"  # Update with your new version
description = ""
readme = "README.md"
authors = []
packages = [
    { include = "metriport", from = "src"}
]
```

#### 2. Copy Generated SDK Files

Put the contents of the generated SDK into a folder called `src/metriport`:

```bash
mkdir -p src/metriport
cp -r ../../../../fern/generated-sdks/python/* src/metriport/
```

#### 3. Build the Package

Install build tools and create the distribution files:

```bash
# Activate your virtual environment
source .venv/bin/activate

# Install build tools
pip install build twine

# Build the package
python -m build
```

This creates `.tar.gz` and `.whl` files in the `dist/` directory.

#### 4. Clean Distribution Directory (if needed)

If you get errors about unknown distribution formats, clean up any extra files:

```bash
cd dist/
rm -rf .DS_Store metriport-X.Y.Z/  # Remove any directories or system files
cd ..
```

Only `.whl` and `.tar.gz` files should remain in `dist/`.

#### 5. Upload to PyPI

Upload the package using twine:

```bash
python -m twine upload dist/*
```

When prompted:
- **Username**: `__token__`
- **Password**: Your PyPI token (find it at https://start.1password.com)

#### 6. Verify the Published Package

Test the newly published package using the `test-pypi-install` directory:

```bash
# Navigate to the test directory
cd ../test-pypi-install

# Activate the virtual environment (Python 3.11)
source .venv/bin/activate

# Upgrade to the newly published version
pip uninstall -y metriport
pip install metriport==X.Y.Z

# Run the test script to verify functionality
python test_sdk.py
```

The test script validates:
- Client initialization
- Medical API methods (patient, facility, document, fhir)
- FHIR types module with 971+ resource types
- Type imports (BasePatient, Address, etc.)

**Note:** The `test-pypi-install` directory already exists with a Python 3.11 virtual environment and test script. If you need to create a new test environment from scratch:

```bash
# Create a test directory
mkdir test-install && cd test-install

# Create a virtual environment with Python 3.11
python3.11 -m venv .venv
source .venv/bin/activate

# Install the new version
pip install metriport==X.Y.Z

# Create a test script to verify functionality
python -c "from metriport import Metriport; print('✓ SDK imported successfully')"
```

### Editor Setup

Install the pylance and mypy plugins to get code completion in your editor.

