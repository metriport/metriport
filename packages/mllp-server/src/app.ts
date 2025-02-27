import { Hl7Server } from "@medplum/hl7";
import * as dotenv from "dotenv";
import { out } from "@metriport/core/util/log";
import type { Logger } from "@metriport/core/util/log";

dotenv.config();

const MLLP_PORT = 2575;

async function createHl7Server(logger: Logger): Promise<Hl7Server> {
  const server = new Hl7Server(connection => {
    logger.log("Connection received");

    connection.addEventListener("message", ({ message }) => {
      logger.log(
        `## New Message from ${connection.socket.remoteAddress}:${connection.socket.remotePort} ##`
      );
      message.segments.forEach(segment => {
        logger.log("Segment:", segment.toString());
      });
      logger.log("\n\n");
      connection.send(message.buildAck());
    });

    connection.addEventListener("error", error => {
      if (error instanceof Error) {
        logger.log("Connection error:", error);
      } else {
        logger.log("Connection terminated by client");
      }
    });

    connection.addEventListener("close", () => {
      logger.log("Connection closed");
    });
  });

  return server;
}

async function main() {
  const logger = out("MLLP Server");
  const server = await createHl7Server(logger);
  server.start(MLLP_PORT);
}

main();
