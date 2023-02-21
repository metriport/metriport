/* eslint-disable @typescript-eslint/no-explicit-any */
import proxy from "express-http-proxy";

const URN_OID_PREFIX = "urn:oid:";

const updateDocumentReferenceQueryString = (params: string): string => {
  const decodedParams = decodeURIComponent(decodeURI(params));
  return (
    decodedParams
      .replace(/patient\.identifier/i, "patient")
      // eslint-disable-next-line no-useless-escape
      .replace(/urn\:oid\:.+\|(2\.[\.\d]+)/g, "$1")
  );
};
const updateQueryString = (path: string, params: string): string | undefined => {
  if (path.toLocaleLowerCase().includes("documentreference")) {
    return updateDocumentReferenceQueryString(params);
  }
  return undefined;
};

// TODO make this dynamic/config/secret
const router = proxy("https://fhir.staging.metriport.com", {
  // const router = proxy("http://localhost:8888", {
  proxyReqPathResolver: function (req) {
    console.log(`ORIGINAL URL: `, req.url);
    const parts = req.url.split("?");
    const path = parts[0];
    const queryString = parts.length ? updateQueryString(path, parts[1]) : undefined;
    const updatedURL = "/fhir" + path + (queryString ? "?" + queryString : "");
    console.log(`UPDATED URL: `, updatedURL);
    return updatedURL;
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userResDecorator: function (proxyRes, proxyResData, userReq, userRes) {
    const payloadString = proxyResData.toString("utf8");
    console.log(`ORIGINAL RESPONSE: `, JSON.stringify(JSON.parse(payloadString), undefined, 2));
    // const orgRegex = /"Organization\/(.+)"/g;
    // const orgReplace = `"Organization/urn:oid:$1"`;
    // eslint-disable-next-line no-useless-escape
    const urlRegex = /https\:\/\/fhir\.staging\.metriport\.com/g;
    const urlReplace = `https://api.staging.metriport.com`;
    const updatedPayload = payloadString
      // .replace(orgRegex, orgReplace)
      .replace(urlRegex, urlReplace);
    const payload = JSON.parse(updatedPayload);
    if (payload.entry) {
      payload.entry
        .filter((e: any) => e.resource?.resourceType === `DocumentReference`)
        .forEach((e: any) => {
          e.resource.id = URN_OID_PREFIX + e.resource.id;
          // const contained = e.resource?.contained;
          // if (contained) {
          //   contained
          //     .filter((c: any) => c.resourceType === `Organization`)
          //     .forEach((c: any) => (c.id = URN_OID_PREFIX + c.id));
          // }
        });
      // payload.entry
      //   .filter((e: any) => e.resource?.resourceType === `Organization`)
      //   .map((e: any) => e.resource)
      //   .forEach((r: any) => (r.id = URN_OID_PREFIX + r.id));
    }
    console.log(`UPDATED RESPONSE: `, JSON.stringify(payload, undefined, 2));
    return JSON.stringify(payload);
  },
});
export default router;
