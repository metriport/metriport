# Account Initialization Script

This script fully initializes a new account at Metriport by creating an organization, facilities, and granting MAPI access.

## Features

- **HTTP API Integration**: Uses HTTP endpoints instead of direct database access
- **Organization Creation**: Creates an organization with specified type and treatment type via API
- **Random Facility Generation**: Automatically generates realistic facilities with random names, NPIs, addresses, and types
- **MAPI Access**: Grants Medical API access to the account via API
- **Fully Automated Data Generation**: Uses Faker.js to generate all facility data including names, NPIs, addresses, and facility types
- **Minimal Configuration**: Only requires organization details and number of facilities
- **Input Validation**: Validates all input parameters before execution
- **Error Handling**: Comprehensive error handling with detailed logging
- **Confirmation Prompts**: Interactive confirmation showing generated data before execution
- **Flexible API Configuration**: Configurable API base URL and authentication

## Prerequisites

1. Metriport API server running and accessible
2. Required dependencies installed (axios, commander, faker-js)
3. `API_URL` environment variable set to the API base URL (e.g., `http://localhost:8080`)

## Setup

1. **Run the script with command-line arguments**:

   ```bash
   # With auto-generated organization name
   ts-node src/account-initialization/init-account.ts --org-type healthcare_provider --facility-count 5

   # With custom organization name
   ts-node src/account-initialization/init-account.ts --org-name "My Organization" --org-type healthcare_provider --facility-count 5
   ```

2. **View help for all options**:
   ```bash
   ts-node src/account-initialization/init-account.ts --help
   ```

## Configuration Options

### Organization Types

- `healthcare_provider`: Healthcare provider organization
- `healthcare_it_vendor`: Healthcare IT vendor organization

### Treatment Types

Treatment types are automatically generated randomly from the following options:

- `acuteCare`: Acute care facility
- `ambulatory`: Ambulatory care facility
- `hospital`: Hospital facility
- `labSystems`: Laboratory systems
- `pharmacy`: Pharmacy facility
- `postAcuteCare`: Post-acute care facility

### Facility Types

- `initiator_and_responder`: Can initiate and respond to queries
- `initiator_only`: Can only initiate queries (requires OBO OID)

## Command Line Options

| Option                      | Short | Required | Description                                                  |
| --------------------------- | ----- | -------- | ------------------------------------------------------------ |
| `--org-name <name>`         | `-o`  | No       | Organization name (auto-generated if not provided)           |
| `--org-type <type>`         | `-t`  | Yes      | Organization business type                                   |
| `--facility-type <type>`    | `-f`  | No       | Type of facility (initiator-and-responder or initiator-only) |
| `--facility-count <number>` |       | No       | Number of facilities to create (1-50, default: 3)            |
| `--cq-approved`             |       | No       | Set CareQuality approved status (default: false)             |
| `--cq-active`               |       | No       | Set CareQuality active status (default: false)               |
| `--cw-approved`             |       | No       | Set CommonWell approved status (default: false)              |
| `--cw-active`               |       | No       | Set CommonWell active status (default: false)                |
| `--cx-id <id>`              |       | No       | Customer ID (auto-generated if not provided)                 |

**Note**:

- Organization name is auto-generated using Faker.js if not provided (format: "adjective-color-animal", e.g., "bright-blue-tiger")
- Treatment type is randomly generated from available options
- All facility data is automatically generated using Faker.js, including names, NPIs, addresses, and facility types
- API base URL is configured via the `API_URL` environment variable

## Auto-Generated Data

### Organization Names

When no organization name is provided, the script automatically generates a unique name using Faker.js:

- **Format**: `adjective-color-animal`
- **Examples**: "bright-blue-tiger", "gentle-green-eagle", "swift-red-dolphin"
- **Uniqueness**: Generated names avoid spaces and special characters

### Random Facility Generation

The script automatically generates realistic facility data using Faker.js:

### Generated Facility Names

- Format: `[Prefix] [City] [Type]`
- Examples: "Main Springfield Medical Center", "Central Boston Clinic", "North Austin Health Center"
- Prefixes: Main, Central, North, South, East, West, Downtown, Uptown, Community, Regional
- Types: Medical Center, Clinic, Hospital, Health Center, Medical Group, Family Practice, Urgent Care, Specialty Clinic, Wellness Center, Primary Care

### Generated Data

- **NPIs**: Random 10-digit numbers
- **Addresses**: Realistic US addresses with street, city, state, ZIP
- **Facility Types**: 80% initiator_and_responder, 20% initiator_only
- **OBO OIDs**: Random UUIDs for initiator_only facilities (50% chance each)

### Applied Settings

- `cqApproved`: From CQ_APPROVED env var (default: false)
- `cqActive`: From CQ_ACTIVE env var (default: false)
- `cwApproved`: From CW_APPROVED env var (default: false)
- `cwActive`: From CW_ACTIVE env var (default: false)

## Example Usage

1. **Basic usage (with auto-generated org name)**:

   ```bash
   ts-node src/account-initialization/init-account.ts --org-type healthcare_provider
   ```

2. **Basic usage (with custom org name)**:

   ```bash
   ts-node src/account-initialization/init-account.ts --org-name "Springfield Medical Center" --org-type healthcare_provider
   ```

3. **With custom facility count and CQ/CW settings**:

   ```bash
   ts-node src/account-initialization/init-account.ts --org-name "Regional Health System" --org-type healthcare_provider --facility-count 10 --cq-approved --cw-active
   ```

4. **With custom customer ID**:

   ```bash
   ts-node src/account-initialization/init-account.ts --org-name "Test Organization" --org-type healthcare_it_vendor --facility-count 2 --cx-id "custom-customer-id"
   ```

5. **View help**:

   ```bash
   ts-node src/account-initialization/init-account.ts --help
   ```

6. **Follow prompts**:
   - Review the configuration summary
   - Type 'yes' to confirm
   - Wait for completion

## Output

The script will:

1. Display a configuration summary
2. Ask for confirmation
3. Create the organization
4. Create all facilities
5. Grant MAPI access
6. Display a completion summary

## Error Handling

The script includes comprehensive error handling:

- Input validation before execution
- Database connection verification
- Detailed error messages with context
- Graceful failure with exit codes

## Database Tables Affected

- `organization`: New organization record
- `facility`: New facility records
- `mapi_access`: MAPI access grant

## Notes

- The script follows the same pattern as `sync-cxs-to-commonwell.ts`
- All operations are performed sequentially to avoid conflicts
- Database transactions ensure data consistency
- The script is idempotent for MAPI access (can be run multiple times safely)
- Organization and facility creation will fail if they already exist
