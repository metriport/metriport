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
  getSamlHomeCommunityId: function () {
    return getEnvVar("SAML_HOME_COMMUNITY_ID");
  },

  getInboundXcpdUrl: function () {
    return getEnvVar("INBOUND_XCPD_URL");
  },

  getInboundDqUrl: function () {
    return getEnvVar("INBOUND_XCA38_URL");
  },

  getInboundDrUrl: function () {
    return getEnvVar("INBOUND_XCA39_URL");
  },

  getS3BucketName: function () {
    return getEnvVar("S3_BUCKET_NAME");
  },
};
