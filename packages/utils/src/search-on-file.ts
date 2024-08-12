import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";

dayjs.extend(duration);

/**
 * Utility to search for multiple strings on a single file.
 *
 * Useful when we have a very large file and we want to check it if contains certain values in
 * there, like IDs, codes, etc.
 *
 * Set the variables below and run the script.
 */

// Full path of the file name where we want to search on.
const filename = "...";
// Array with the strings we're searching for.
const whatToSearchFor: string[] = [];

async function main() {
  console.log(`Reading contents of file ${filename}...`);
  const contents = fs.readFileSync(filename, "utf-8");

  console.log(`Searching on the file contents...`);
  const foundOnes = whatToSearchFor.flatMap(searchFor => {
    return contents.includes(searchFor) ? searchFor : [];
  });

  console.log(`Found these:\n- ${foundOnes.join("\n- ")}`);
}

main();
