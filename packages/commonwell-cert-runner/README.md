# CommonWell Certification Runner

A comprehensive tool by Metriport Inc. for running through CommonWell Alliance certification test cases and validating your integration with the CommonWell network.

## What It Does

The CommonWell Certification Runner automates the testing of CommonWell API integration across five main certification areas:

### 1. Organization Management (`org-management.ts`)

- Creates, retrieves, updates, and manages CommonWell organizations
- Handles certificate management (add, replace, delete certificates)
- Validates organization CRUD operations
- Tests member-level organization management APIs

### 2. Patient Management (`patient-management.ts`)

- Creates and updates patients with test demographics
- Tests patient merge operations
- Validates patient deletion workflows
- Uses predefined test patients (Tracy Crane, Connie Carin)
- Automatically cleans up test patients after execution

### 3. Link Management (`link-management.ts`)

- Tests patient linking and unlinking operations
- Validates probable link detection and management
- Tests link reset functionality
- Uses demographic matching to find potential patient links

### 4. Document Consumption (`document-consumption.ts`)

- Queries for external documents on test patients
- Downloads and stores document references and contents
- Tests document retrieval workflows
- Supports multiple document statuses (current, superseded, entered-in-error)

### 5. Document Contribution (`document-contribution.ts`)

- Tests document contribution workflows between organizations
- Creates patients on both contributor and consumer organizations
- Links patients across organizations
- Initializes HTTP server for document contribution responses
- Validates end-to-end document sharing
- Requires a public URL to respond to the requests from CommonWell (reverse proxy -
  see `src/flows/document-contribution.ts`).

## Requirements

### Prerequisites

- Node.js 18+
- npm or yarn package manager
- CommonWell Alliance membership and credentials

### CommonWell Credentials

You need the following credentials from CommonWell:

**Member Organization (Service Adopter):**

- Member ID and OID
- Member name
- RSA private key and certificate for member operations

**Organization (Your Organization):**

- Organization OID
- Organization name
- RSA private key and certificate for organization operations
- Gateway endpoint configuration
- OAuth 2.0 credentials for document contribution

## Installation

### Global Installation

```bash
npm install -g @metriport/commonwell-cert-runner
```

### Local Development

```bash
git clone <repository>
cd packages/commonwell-cert-runner
npm install
npm run build
```

## Configuration

Create a `.env` file with the following required variables:

### Member Organization Configuration

```env
# Member (Service Adopter) credentials
ROOT_OID=1.2.3.4.5.678
CW_MEMBER_ID=your-member-id
CW_MEMBER_NAME=Your Member Name
CW_MEMBER_CERTIFICATE="-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----"
CW_MEMBER_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----"
```

### Organization Configuration

```env
# Your organization credentials
CW_ORG_CERTIFICATE="-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----"
CW_ORG_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----"
CW_ORG_GATEWAY_ENDPOINT=https://your-gateway.example.com/fhir
CW_ORG_GATEWAY_AUTHORIZATION_SERVER_ENDPOINT=https://auth.example.com/oauth/token
CW_ORG_GATEWAY_AUTHORIZATION_CLIENT_ID=your-client-id
CW_ORG_GATEWAY_AUTHORIZATION_CLIENT_SECRET=your-client-secret

# Optional: Use existing organization instead of creating new one
CW_ORG_ID=1.2.3.4.5.678.5.123
```

### Contribution Server Configuration

These configuration variables are used to configure the contribution server. This
should be a public URL that is accessible from the CommonWell network. See
item #5. Document Contribution above for more details.

```env
CONTRIB_SERVER_URL=https://your-contrib-server.example.com/with/path
CONTRIB_SERVER_PORT=8088
```

## Usage

### Run Complete Certification Suite

```bash
cw-cert-runner
```

## Entry Points

### Main Entry Point

- **File**: `src/index.ts`
- **Function**: `main()`
- **Purpose**: Orchestrates the complete certification flow

### Individual Flow Entry Points

If you want to run individual flows, you can comment out the other flows in `src/index.ts`.

1. **Organization Management**: `src/flows/org-management.ts`

   - `orgManagement()`: Complete org management flow
   - `getOneOrg()`: Retrieve specific organization
   - `initApiForExistingOrg()`: Initialize API for existing org

2. **Patient Management**: `src/flows/patient-management.ts`

   - `patientManagement()`: Complete patient management flow

3. **Link Management**: `src/flows/link-management.ts`

   - `linkManagement()`: Complete link management flow

4. **Document Consumption**: `src/flows/document-consumption.ts`

   - `documentConsumption()`: Complete document consumption flow
   - `queryDocuments()`: Query documents for a patient
   - `retrieveDocument()`: Download specific document

5. **Document Contribution**: `src/flows/document-contribution.ts`
   - `documentContribution()`: Complete document contribution flow

### Single Commands

For targeted testing, use individual commands in `src/single-commands/`:

- `init-contrib-server.ts`: Initialize document contribution server
- `patient-create.ts`: Create a single patient
- `patient-get.ts`: Retrieve a patient
- `patient-delete.ts`: Delete a patient
- `patient-get-links.ts`: Get patient links
- `document-parse.ts`: Parse document responses

### Console Output

The runner provides detailed console output including:

- Transaction IDs for each API call
- Request/response payloads
- Success/failure status for each operation
- Patient IDs and document references

### File Output

Documents are downloaded to:

- `./downloads-consumption/`: Document consumption downloads
- `./downloads-contribution/`: Document contribution downloads

### Error Handling

- Failed flows are logged with transaction IDs
- Stack traces are preserved for debugging
- Graceful cleanup of test data

## Troubleshooting

### Common Issues

1. **Certificate Errors**: Ensure certificates are properly formatted with newlines
2. **OAuth Errors**: Verify client credentials and endpoints
3. **Patient Not Found**: Check patient demographics match test data
4. **Document Download Failures**: Verify document URLs are accessible

## Development

```bash
npm install # only has to be run once
npm run build # run to build
npm start # runs the code pointing to `./.env`
```

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:

- GitHub Issues: https://github.com/metriport/metriport/issues
- Email: contact@metriport.com

---

```
            ,▄,
          ▄▓███▌
      ▄▀╙   ▀▓▀    ²▄
    ▄└               ╙▌
  ,▀                   ╨▄
  ▌                     ║
                         ▌
                         ▌
,▓██▄                 ╔███▄
╙███▌                 ▀███▀
    ▀▄
      ▀╗▄         ,▄
         '╙▀▀▀▀▀╙''


      by Metriport Inc.

```
