import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";

dayjs.extend(duration);

const filename = "...";

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
