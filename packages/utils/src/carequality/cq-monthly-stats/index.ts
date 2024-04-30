import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { QueryTypes } from "sequelize";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { sleep } from "@metriport/shared";
import { xcpdStats } from "./xcpd-stats";
import { xcaDQStats } from "./xca-dq-stats";
import { xcaDRStats } from "./xca-dr-stats";
import { readOnlyDBPool } from "./shared";

dayjs.extend(duration);

async function main() {
  const sqlCQDirectory = `SELECT * FROM cq_directory_entry`;
  const cqDirectory = await readOnlyDBPool.query(sqlCQDirectory, {
    type: QueryTypes.SELECT,
  });

  console.log("cqDirectory:", cqDirectory.length);

  const previousMonth = dayjs();
  const daysInPreviousMonth = previousMonth.daysInMonth();
  const endOfPreviousMonth = previousMonth.endOf("month").format("YYYY-MM-DD");

  for (let i = 0; i < daysInPreviousMonth; i++) {
    const day = dayjs().subtract(i, "day").format("YYYY-MM-DD");
    const baseDir = `./runs`;
    const baseDirDay = `${baseDir}/${day}`;
    fs.mkdirSync(baseDirDay, { recursive: true });

    console.log("day:", day);

    const params = { cqDirectory, endOfPreviousMonth, dayIndex: i };

    const xcpd = await xcpdStats(params);
    const xcaDQ = await xcaDQStats(params);
    const xcaDR = await xcaDRStats(params);

    fs.writeFileSync(`${baseDirDay}/xcpd.json`, JSON.stringify(xcpd, null, 2));
    fs.writeFileSync(`${baseDirDay}/xcaDQ.json`, JSON.stringify(xcaDQ, null, 2));
    fs.writeFileSync(`${baseDirDay}/xcaDR.json`, JSON.stringify(xcaDR, null, 2));

    await sleep(60000);
  }

  process.exit(0);
}

main();
