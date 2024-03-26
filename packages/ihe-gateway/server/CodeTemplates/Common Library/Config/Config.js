/**
 * This module provides a standardized way to access environment variables.
 */

function getEnvVar(name) {
  const value = java.lang.String(Packages.java.lang.System.getenv(name));
  if (value == null) {
    throw new Error(`Environment variable ${name} is not defined.`);
  }
  return value;
}

const Config = {
  getHomeCommunityId: function () {
    return getEnvVar("HOME_COMMUNITY_ID");
  },
  getHomeCommunityName: function () {
    return getEnvVar("HOME_COMMUNITY_NAME");
  },

  getApiBaseAddress: function () {
    return getEnvVar("API_BASE_ADDRESS");
  },

  // TODO replace this by lambda name
  getInboundPatientDiscoveryURL: function () {
    return getEnvVar("INBOUND_PATIENT_DISCOVERY_URL");
  },
  // TODO replace this by lambda name
  getInboundDocumentQueryURL: function () {
    return getEnvVar("INBOUND_DOCUMENT_QUERY_URL");
  },
  // TODO replace this by lambda name
  getInboundDocumentRetrievalURL: function () {
    return getEnvVar("INBOUND_DOCUMENT_RETRIEVAL_URL");
  },

  getS3BucketName: function () {
    return getEnvVar("S3_BUCKET_NAME");
  },
};
