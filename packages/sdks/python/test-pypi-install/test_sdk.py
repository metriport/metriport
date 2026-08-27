"""
Test script to verify the metriport SDK works correctly
"""

import metriport
from metriport import Metriport

print("Testing metriport SDK version 9.2.0...")
print()

# Test 1: Initialize the client
print("Test 1: Initializing Metriport client...")
client = None
try:
    client = Metriport(
        api_key="test-value"
    )
    print("✓ Client initialized successfully")
except Exception as e:
    print(f"✗ Failed to initialize client: {e}")
    import sys
    sys.exit(1)

print()

# Test 2: Check if client has expected methods
print("Test 2: Checking client methods...")
expected_methods = ["medical"]
for method in expected_methods:
    if hasattr(client, method):
        print(f"✓ Client has '{method}' method")
    else:
        print(f"✗ Client missing '{method}' method")

# Verify FHIR client is under medical (not as top-level client method)
if not hasattr(client, "fhir"):
    print("✓ FHIR client correctly nested under medical (not top-level)")
else:
    print("✗ Unexpected: FHIR client found at top level")

# But verify FHIR types module exists at package level
print()
print("Test 2b: Checking FHIR types module...")
try:
    import metriport.fhir
    print("✓ FHIR types module available at package level (metriport.fhir)")
    # Check if it has FHIR resource types
    fhir_types = [x for x in dir(metriport.fhir) if not x.startswith('_') and x[0].isupper()]
    if fhir_types:
        print(f"  ✓ Found {len(fhir_types)} FHIR types (e.g., {', '.join(fhir_types[:3])}...)")
except Exception as e:
    print(f"✗ Failed to import metriport.fhir: {e}")

print()

# Test 3: Access medical API methods
print("Test 3: Accessing medical API methods...")
try:
    medical_client = client.medical
    print("✓ Medical client accessible")
    
    # Check for expected sub-clients
    sub_clients = ["patient", "facility", "document", "fhir"]
    for sub_client in sub_clients:
        if hasattr(medical_client, sub_client):
            print(f"  ✓ Has '{sub_client}' sub-client")
        else:
            print(f"  ✗ Missing '{sub_client}' sub-client")
except Exception as e:
    print(f"✗ Failed to access medical client: {e}")

print()

# Test 4: Check types are importable
print("Test 4: Importing common types...")
try:
    from metriport.medical.patient import BasePatient
    from metriport.commons import Address
    print("✓ BasePatient type imported successfully")
    print("✓ Address type imported successfully")
except Exception as e:
    print(f"✗ Failed to import types: {e}")

print()
print("All basic tests completed!")

