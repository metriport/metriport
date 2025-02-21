import { Hl7Server } from "@medplum/hl7";
import * as dotenv from "dotenv";
import { ConsoleLogger, Logger } from "./logger";
dotenv.config();

const HL7_PORT = process.env.HL7_PORT ? parseInt(process.env.HL7_PORT) : 2575;

async function createHl7Server(logger: Logger): Promise<Hl7Server> {
  const server = new Hl7Server(connection => {
    logger.info("Connection received");

    connection.addEventListener("message", ({ message }) => {
      logger.debug(
        `## New Message from ${connection.socket.remoteAddress}:${connection.socket.remotePort} ##`
      );
      message.segments.forEach(segment => {
        logger.debug("Segment:", segment.toString());
      });
      logger.debug("\n\n");
      connection.send(message.buildAck());
    });

    connection.addEventListener("error", error => {
      if (error instanceof Error) {
        logger.error("Connection error:", error);
      } else {
        logger.debug("Connection terminated by client");
      }
    });

    connection.addEventListener("close", () => {
      logger.info("Connection closed");
    });
  });

  return server;
}

async function main() {
  const logger = new ConsoleLogger();
  logger.info("Starting HL7 server...");

  const server = await createHl7Server(logger);
  server.start(HL7_PORT);
}

main();
