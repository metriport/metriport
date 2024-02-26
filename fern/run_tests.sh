#!/bin/bash

# Fern generate
fern generate --group test

# Java tests
( cd packages/sdks/java/tester-local && ./gradlew test --no-build-cache)

# Python tests
( cd packages/sdks/python/tester-local && poetry install && pip install -r requirements.txt && poetry run pytest tests )

# TypeScript tests
( cd packages/sdks/typescript/tester-local && npm test )