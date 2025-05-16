import fs from "fs";
import path from "path";
import { Bundle, Resource } from "@medplum/fhirtypes";

function compareResourceIds(dir1: string, dir2: string): void {
  const files1 = fs.readdirSync(dir1).filter(file => file.endsWith(".json"));
  const files2 = fs.readdirSync(dir2).filter(file => file.endsWith(".json"));

  const commonFiles = files1.filter(file => files2.includes(file));

  commonFiles.forEach(file => {
    const path1 = path.join(dir1, file);
    const path2 = path.join(dir2, file);

    const content1 = fs.readFileSync(path1, "utf-8");
    const content2 = fs.readFileSync(path2, "utf-8");

    const bundle1 = JSON.parse(content1) as Bundle;
    const bundle2 = JSON.parse(content2) as Bundle;

    const resources1 =
      bundle1.entry?.map(entry => entry.resource).filter((r): r is Resource => !!r) ?? [];
    const resources2 =
      bundle2.entry?.map(entry => entry.resource).filter((r): r is Resource => !!r) ?? [];

    const ids1 = new Set(resources1.map(r => `${r.resourceType}/${r.id}`));
    const ids2 = new Set(resources2.map(r => `${r.resourceType}/${r.id}`));

    const onlyInDir1 = [...ids1].filter(id => !ids2.has(id));
    const onlyInDir2 = [...ids2].filter(id => !ids1.has(id));

    if (onlyInDir1.length > 0 || onlyInDir2.length > 0) {
      console.log(`File: ${file}`);
      if (onlyInDir1.length > 0) {
        console.log(`  Only in ${path.basename(dir1)}:`);
        onlyInDir1.forEach(id => console.log(`    ${id}`));
      }
      if (onlyInDir2.length > 0) {
        console.log(`  Only in ${path.basename(dir2)}:`);
        onlyInDir2.forEach(id => console.log(`    ${id}`));
      }
      console.log();
    }
  });
}

if (process.argv.length !== 4) {
  console.log("Usage: node compare-dedups.ts <directory1> <directory2>");
  process.exit(1);
}

const dir1 = process.argv[2];
const dir2 = process.argv[3];

compareResourceIds(dir1, dir2);
