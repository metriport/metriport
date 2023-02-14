import proxy from "express-http-proxy";

// TODO make this dynamic/config/secret
const router = proxy("https://fhir.staging.metriport.com", {
  proxyReqPathResolver: function (req) {
    return new Promise(function (resolve) {
      const parts = req.url.split("?");
      const updatedPath = parts[0];
      const queryString =
        parts.length > 1
          ? decodeURIComponent(decodeURI(parts[1]))
              .replace(/patient\.identifier/i, "patient")
              .replace(/urn:oid:/i, "")
              .replace(/[\^\|]/g, "..") // eslint-disable-line no-useless-escape
          : undefined;
      const resolvedPathValue = updatedPath + (queryString ? "?" + queryString : "");
      resolve("/fhir" + resolvedPathValue);
    });
  },
});
export default router;
