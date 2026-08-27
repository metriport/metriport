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

import { MetriportError } from "@metriport/shared";
import { MultipartParser } from "formidable";
import MIMEType from "whatwg-mimetype";

export interface MtomPart {
  body: Buffer;
  headers: Record<string, string>;
}

export interface MtomAttachments {
  parts: MtomPart[];
}

type ParserState = {
  headerName: string;
  headerValue: string;
  data: Buffer;
  partIndex: number;
};

type ParserDataEvent = {
  name: string;
  buffer: Buffer;
  start: number;
  end: number;
};

function handleParserData(resp: MtomAttachments, state: ParserState, event: ParserDataEvent): void {
  const { name, buffer, start, end } = event;
  switch (name) {
    case "partBegin":
      resp.parts[state.partIndex] = {
        body: Buffer.from(""),
        headers: {},
      };
      state.data = Buffer.from("");
      break;
    case "headerField":
      state.headerName = buffer.slice(start, end).toString();
      break;
    case "headerValue":
      state.headerValue = buffer.slice(start, end).toString();
      break;
    case "headerEnd": {
      const part = resp.parts[state.partIndex];
      if (!part) {
        throw new MetriportError("Part not found in headerEnd");
      }
      part.headers[state.headerName.toLowerCase()] = state.headerValue;
      break;
    }
    case "partData":
      state.data = Buffer.concat([state.data, buffer.slice(start, end)]);
      break;
    case "partEnd": {
      const part = resp.parts[state.partIndex];
      if (!part) {
        throw new MetriportError("Part not found in partEnd");
      }
      part.body = state.data;
      state.partIndex++;
      break;
    }
  }
}

export async function parseMtomResponse(
  payload: Buffer,
  boundary: string
): Promise<MtomAttachments> {
  return new Promise(function executor(resolve, reject) {
    const resp: MtomAttachments = {
      parts: [],
    };
    const state: ParserState = {
      headerName: "",
      headerValue: "",
      data: Buffer.from(""),
      partIndex: 0,
    };
    const parser = new MultipartParser();

    parser.initWithBoundary(boundary);
    parser.on("data", function onData(event: ParserDataEvent) {
      handleParserData(resp, state, event);
    });

    parser.on("end", function onEnd() {
      resolve(resp);
    });
    parser.on("error", reject);

    parser.write(payload);
    parser.end();
  });
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getBoundaryFromMtomResponse(contentType: any): string | undefined {
  const parsedContentType = MIMEType.parse(contentType);
  if (!parsedContentType) {
    throw new MetriportError("Parsing of content type failed");
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
