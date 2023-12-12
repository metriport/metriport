import { DocumentQueryResponse } from "@metriport/ihe-gateway-sdk";

export async function handleDocQueryResponse(
  docQueryResponse: DocumentQueryResponse
): Promise<void> {
  // Only download files that are not stored
  // I cant tell before hand if something is convertible or not here
  // That will need to be done by the lambda listening to docs being uploaded
  // We need to take into account the count
  // Check if we have the docs
  // If we dont trigger cq doc retrieval
}

// AFAIK wont be able to know if its convertible until downloaded
// Also marking it as complete will need to change as well

// idea 1
// is when cq starts just add the counts on top of whats already there

// CW
// Get the doc refs
// we check which ones we have downloaded
// We set the count for amount to download as well as xml to convert
// When downloading is complete we mark the download status as complete and send a webhook to cx
// In the background docs are converted and stored in fhir and each time the ticker ups the successfully counted
// until they are all converted at which point we sent that it is completed

//
