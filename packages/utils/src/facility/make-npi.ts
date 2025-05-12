import { makeNPI } from "@metriport/shared/common/__tests__/npi";

/**
 * Generate 10 random NPI numbers and print them to the console.
 *
 * Run with:
 * > npm run make-npi
 */
export function main() {
  for (let i = 0; i < 10; i++) {
    console.log(makeNPI());
  }
}

main();
