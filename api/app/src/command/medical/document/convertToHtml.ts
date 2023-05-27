// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import path from "path";
import SaxonJS from "saxon-js";

export const convertToHtml = async (document: string) => {
  const result = await SaxonJS.transform(
    {
      stylesheetFileName: path.resolve(__dirname, "test.sef.json"),
      sourceText: document,
      destination: "serialized",
    },
    "async"
  );

  return result.principalResult;
};
