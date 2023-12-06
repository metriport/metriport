import * as xml2js from "xml2js";

export function parseXmlString(xml: string): void {
  xml = JSON.parse(`"${xml}"`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  xml2js.parseString(xml, (err: Error | null, result: any) => {
    if (err) {
      console.error(err);
      return;
    }
    if (
      result &&
      result["s:Body"] &&
      result["s:Body"][0] &&
      result["s:Body"][0]["PRPA_IN201305UV02"]
    ) {
      const patientName =
        result["s:Body"][0]["PRPA_IN201305UV02"]["controlActProcess"][0]["queryByParameter"][0][
          "parameterList"
        ][0]["livingSubjectName"][0]["value"][0];
      console.log("Patient Name:", patientName);
    } else {
      console.log("Unable to parse XML");
    }
  });
}
