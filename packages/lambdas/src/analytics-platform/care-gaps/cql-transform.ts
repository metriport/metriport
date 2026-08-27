import { CqlTransformDirect } from "@metriport/core/command/analytics-platform/cql-engine/command/cql-transform/cql-transform-direct";
import { cqlTransformSchema } from "@metriport/shared/domain/cql-engine/transform";
import { SQSEvent } from "aws-lambda";
import { capture } from "../../shared/capture";
import { parseBody } from "../../shared/parse-body";
import { getSingleMessageOrFail } from "../../shared/sqs";

// Keep this as early on the file as possible
capture.init();

export const handler = capture.wrapHandler(async (event: SQSEvent) => {
  capture.setExtra({ event, context: "CqlTransform" });

  const message = getSingleMessageOrFail(event.Records, "CqlTransform");
  if (!message) return;

  const parsedBody = parseBody<typeof cqlTransformSchema>(cqlTransformSchema, message.body);

  const cqlTransformHandler = new CqlTransformDirect();
  await cqlTransformHandler.processCqlTransformSync(parsedBody);
});
