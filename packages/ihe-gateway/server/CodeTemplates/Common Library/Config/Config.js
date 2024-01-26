/**
 * Provides a standardized way to access environment variables.
 */
const Config = {
  getSamlHomeCommunityId: function () {
    return java.lang.String(Packages.java.lang.System.getenv("SAML_HOME_COMMUNITY_ID"));
  },

  getInboundXcpdUrl: function () {
    return java.lang.String(Packages.java.lang.System.getenv("INBOUND_XCPD_URL"));
  },

  getInboundDqUrl: function () {
    return java.lang.String(Packages.java.lang.System.getenv("INBOUND_XCA38_URL"));
  },

  getInboundDrUrl: function () {
    return java.lang.String(Packages.java.lang.System.getenv("INBOUND_XCA39_URL"));
  },

  getS3BucketName: function () {
    return java.lang.String(Packages.java.lang.System.getenv("S3_BUCKET_NAME"));
  },
};
