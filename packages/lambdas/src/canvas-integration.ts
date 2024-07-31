type CanvasIntegrationLambdaRequest = {
  patientId: string;
  cxId: string;
};

export async function handler(event: CanvasIntegrationLambdaRequest) {
  console.log("Received event:", JSON.stringify(event, null, 2));

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Event logged successfully" }),
  };
}
