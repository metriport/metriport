// -------------------------------------------------------------------------------------------------
// Copyright (c) 2022-present Metriport Inc.
//
// Licensed under AGPLv3. See LICENSE in the repo root for license information.
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//    Copyright (C) 2013 Vinay Pulim
//    Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//    The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
// -------------------------------------------------------------------------------------------------

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
          case "headerEnd": {
            const part = resp.parts[partIndex];
            if (!part) {
              throw new Error("Part not found in headerEnd");
            }
            part.headers[headerName.toLowerCase()] = headerValue;
            break;
          }
          case "partData":
            data = Buffer.concat([data, buffer.slice(start, end)]);
            break;
          case "partEnd": {
            const part = resp.parts[partIndex];
            if (!part) {
              throw new Error("Part not found in partEnd");
            }
            part.body = data;
            partIndex++;
            break;
          }
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
