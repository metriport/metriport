# Surescripts commands

## SFTP commands

Test the SFTP connection to Surescripts.

```
npm run surescripts -- sftp connect
```

List all files in the remote SFTP directory.

```
npm run surescripts -- sftp list /from_surescripts
```

Synchronize all remote files to the local SFTP directory.

```
npm run surescripts -- sftp sync /from_surescripts
```

## Request commands

Send a patient request to Surescripts.

```
npm run surescripts -- request --cx-id [CXID] --facility-id [UUID] --patient-id [UUID]
```

Send a batch request to Surescripts.

```
npm run surescripts -- batch-request --cx-id [CXID] --facility-id [UUID] --transmission-id [UUID]
```

Verify a request in the Surescripts history.

```
npm run surescripts -- verify-request --cx-id [CXID] --facility-id [UUID] --transmission-id [TXID]
```

Receive a response from Surescripts.

```
npm run surescripts -- receive-response --cx-id [CXID] --facility-id [UUID] --transmission-id [TXID]
```

Convert a response from Surescripts to FHIR.

```
npm run surescripts -- convert-response --cx-id [CXID] --facility-id [UUID] --transmission-id [TXID] --population-id [UUID]
```

Convert a customer response from Surescripts to FHIR.

```
npm run surescripts -- convert-customer-response --cx-id [CXID] --facility-id [UUID] --transmission-id [TXID] --population-id [UUID]
```

Analyze a response from Surescripts.

```
npm run surescripts -- analysis --cx-id [CXID] --facility-id [UUID] --transmission-id [TXID] --patient-id [UUID]
```

Analyze a batch response from Surescripts.

```
npm run surescripts -- analyze-batch-response --cx-id [CXID] --facility-id [UUID] --transmission-id [TXID] --population-id [UUID]
```
