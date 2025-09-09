#!/usr/bin/env ts-node

/**
 * Example usage of the account initialization script
 *
 * This file shows example command-line usage for the account initialization script.
 */

console.log("Account Initialization Script - Example Usage");
console.log("=============================================");

console.log("\n1. Basic usage (with auto-generated org name):");
console.log("ts-node src/account-initialization/init-account.ts --org-type healthcare_provider");

console.log("\n2. Basic usage (with custom org name):");
console.log(
  'ts-node src/account-initialization/init-account.ts --org-name "Springfield Medical Center" --org-type healthcare_provider'
);

console.log("\n3. With custom facility count:");
console.log(
  'ts-node src/account-initialization/init-account.ts --org-name "Regional Health System" --org-type healthcare_provider --facility-count 10'
);

console.log("\n4. With CQ/CW settings enabled:");
console.log(
  'ts-node src/account-initialization/init-account.ts --org-name "Test Organization" --org-type healthcare_it_vendor --facility-count 5 --cq-approved --cw-active'
);

console.log("\n5. With custom customer ID:");
console.log(
  'ts-node src/account-initialization/init-account.ts --org-name "Custom Org" --org-type healthcare_provider --facility-count 3 --cx-id "my-custom-id"'
);

console.log("\n6. View help:");
console.log("ts-node src/account-initialization/init-account.ts --help");

console.log("\nCommand Line Options:");
console.log(
  "-o, --org-name <name>        Organization name (optional, auto-generated if not provided)"
);
console.log(
  "-t, --org-type <type>        Organization type: healthcare_provider or healthcare_it_vendor (required)"
);
console.log(
  "-f, --facility-type <type>   Facility type: initiator_and_responder or initiator_only (optional)"
);
console.log("--facility-count <number>    Number of facilities to create (1-50, default: 3)");
console.log("--cq-approved                Set CareQuality approved status (default: false)");
console.log("--cq-active                  Set CareQuality active status (default: false)");
console.log("--cw-approved                Set CommonWell approved status (default: false)");
console.log("--cw-active                  Set CommonWell active status (default: false)");
console.log("--cx-id <id>                 Customer ID (auto-generated if not provided)");

console.log("\nAvailable organization types:");
console.log("- healthcare_provider");
console.log("- healthcare_it_vendor");

console.log("\nTreatment types (auto-generated randomly):");
console.log("- acuteCare");
console.log("- ambulatory");
console.log("- hospital");
console.log("- labSystems");
console.log("- pharmacy");
console.log("- postAcuteCare");

console.log("\nAuto-generated facility data:");
console.log('- Random facility names (e.g., "Main Springfield Medical Center")');
console.log("- Random NPIs (10-digit numbers)");
console.log("- Random addresses (realistic US addresses)");
console.log("- Random facility types (80% initiator_and_responder, 20% initiator_only)");
console.log("- Random OBO OIDs for initiator_only facilities");
