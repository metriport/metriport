// TODO move this to a shared library in core, so we can turn this into a script and not endoint, so it can live
// in the codebase uncommented and ready for use.
/**
 * Endpoint to populate the DLQ with messages for testing purposes
 */
// router.post(
//   "/sqs-populate",
//   asyncHandler(async (req: Request, res: Response) => {
//     const dlqUrl = Config.getSidechainFHIRConverterDQLURL();
//     if (!dlqUrl) throw new BadRequestError("Missing sidechain DLQ URL");
//     const messageCountRaw = getFrom("query").optional("maxNumberOfMessages", req);
//     const randomizeFilename = getFrom("query").optional("randomizeFilename", req) === "true";
//     console.log(
//       `Params: messageCountRaw=${messageCountRaw}, randomizeFilename=${randomizeFilename}`
//     );
//     const body = req.body;
//     if (randomizeFilename) body.s3FileName = uuidv4();
//     const payload = JSON.stringify(body);
//     const messageCount = messageCountRaw ? parseInt(messageCountRaw) : 11;
//     console.log(`Sending ${messageCount} messages to the queue`);
//     await Promise.allSettled(
//       [...Array(messageCount).keys()].map(async () => {
//         return sendMessageToQueue(dlqUrl ?? "NA", payload, {
//           messageAttributes: {
//             cxId: uuidv4(),
//             // intentional so it fails to process
//             // patientId: uuidv4(),
//             jobIdId: uuidv4(),
//           },
//         });
//       })
//     );

//     return res.sendStatus(200);
//   })
// );
