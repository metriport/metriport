## Local Java SDK

This java project uses the locally generated Fern Java SDK 
and runs tests against the Metriport API.

### Regenerating the Java SDK

To update the generated SDK locally for testing, run
```bash
fern generate --group test
```
You will be prompted to sign in. Do this.

To run the tests, run the following commands
```bash
# Run cd packages/sdks/java 
./gradlew test
```

To add more tests, open up the java directory in IntelliJ 
and you'll get autocomplete + intellisense. 

