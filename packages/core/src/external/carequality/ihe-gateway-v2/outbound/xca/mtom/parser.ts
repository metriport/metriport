import MIMEType from "whatwg-mimetype";
import { MultipartParser } from "formidable";

export interface MtomPart {
  body: Buffer;
  headers: Record<string, string>;
}

export interface MtomAttachments {
  parts: MtomPart[];
}

export async function parseMtomResponse(
  payload: Buffer,
  boundary: string
): Promise<MtomAttachments> {
  return new Promise((resolve, reject) => {
    const resp: MtomAttachments = {
      parts: [],
    };
    let headerName = "";
    let headerValue = "";
    let data: Buffer;
    let partIndex = 0;
    const parser = new MultipartParser();

    parser.initWithBoundary(boundary);
    parser.on(
      "data",
      ({
        name,
        buffer,
        start,
        end,
      }: {
        name: string;
        buffer: Buffer;
        start: number;
        end: number;
      }) => {
        switch (name) {
          case "partBegin":
            resp.parts[partIndex] = {
              body: Buffer.from(""),
              headers: {},
            };
            data = Buffer.from("");
            break;
          case "headerField":
            headerName = buffer.slice(start, end).toString();
            break;
          case "headerValue":
            headerValue = buffer.slice(start, end).toString();
            break;
          case "headerEnd":
            //eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            resp.parts[partIndex]!.headers[headerName.toLowerCase()] = headerValue;
            break;
          case "partData":
            data = Buffer.concat([data, buffer.slice(start, end)]);
            break;
          case "partEnd":
            //eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            resp.parts[partIndex]!.body = data;
            partIndex++;
            break;
        }
      }
    );

    parser.on("end", () => resolve(resp));
    parser.on("error", reject);

    parser.write(payload);
    parser.end();
  });
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getBoundaryFromMtomResponse(contentType: any): string | undefined {
  const parsedContentType = MIMEType.parse(contentType);
  if (!parsedContentType) {
    throw new Error("Parsing of content type failed");
  }
  const boundary = parsedContentType.parameters.get("boundary");
  return boundary;
}

export function convertSoapResponseToMtomResponse(buffer: Buffer): MtomAttachments {
  return {
    parts: [
      {
        body: buffer,
        headers: {},
      },
    ],
  };
}
