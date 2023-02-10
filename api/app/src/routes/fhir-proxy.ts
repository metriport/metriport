import proxy from "express-http-proxy";

// const router = Router();

// const getHeaderOrFail = (req: Request, name: string): string => {
//   const header = req.header(name);
//   if (header == undefined) throw new Error(`Missing header ${name}`);
//   return header;
// };
//
// router.get(
//   "/*",
//   asyncHandler(async (req: Request, res: Response) => {
//     console.log(`RUNNING...`);
//     // const fhirServerAddress = "https://fhir.staging.metriport.com"
//     const fhirServerAddress = "http://host.docker.internal:8888/fhir";
//     console.log(`HEADERS: `, req.headers);
//     const headers = {
//       authorization: getHeaderOrFail(req, "authorization"),
//       accept: getHeaderOrFail(req, "accept"),
//       "user-agent": getHeaderOrFail(req, "user-agent"),
//       ...(req.header("Content-Type") ? { "Content-Type": req.header("Content-Type") } : undefined),
//     };
//     const params = req.query;
//     const transformedParams = {
//       ...params,
//       patient: params["patient.identifier"],
//     };
//     console.log(`Body original: `, req.body);
//     console.log(`isBase64Encoded: `, req.isBase64Encoded);
//     const body = req.isBase64Encoded ? Buffer.from(req.body, "base64").toString("ascii") : req.body;
//     console.log(`Body to be sent: `, body);
//     // const respFhir = await axios.post(`https://fhir.staging.metriport.com${req.path}`, body, {
//     //   headers,
//     //   params: transformedParams,
//     //   validateStatus: undefined,
//     // });
//     // return res.set(respFhir.headers).status(respFhir.status).send(respFhir.data);
//     // const respFhir = await axios.post(`${fhirServerAddress}${req.path}`, body, {
//     const respFhir = await axios.post(`${fhirServerAddress}${req.path}`, body, {
//       headers,
//       params: transformedParams,
//       validateStatus: undefined,
//       responseType: "stream",
//     });
//     // return res.set(respFhir.headers).status(respFhir.status).pipe(respFhir.data);
//     res.set(respFhir.headers).status(respFhir.status);
//     respFhir.data.pipe(res);
//     return;
//   })
// );

// const router3 = proxy("http://host.docker.internal:8888", {
const router2 = proxy("https://fhir.staging.metriport.com", {
  proxyReqPathResolver: function (req) {
    return new Promise(function (resolve) {
      const parts = req.url.split("?");
      const updatedPath = parts[0];
      const queryString = parts[1].replace(/patient\.identifier/, "patient");
      const resolvedPathValue = updatedPath + (queryString ? "?" + queryString : "");
      resolve("/fhir" + resolvedPathValue);
    });
  },
});
export default router2;

// export default router;
