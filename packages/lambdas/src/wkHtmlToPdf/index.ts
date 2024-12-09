/**
 * From https://github.com/hkarask/html-to-pdf-lambda
 */
import { Stream } from "node:stream";
import { existsSync } from "fs";
import { spawn } from "child_process";
import { WkOptions } from "./types";

function wkHtmlToPdf(props: WkOptions, input: string | Stream) {
  return new Promise<Buffer>((resolve, reject) => {
    let wkhtmltopdfPath = "/opt/bin/wkhtmltopdf";

    if (process.platform === "darwin") {
      wkhtmltopdfPath = "/usr/local/bin/wkhtmltopdf";
    }

    if (!existsSync(wkhtmltopdfPath)) {
      console.log(`Couldn't find ${wkhtmltopdfPath} - platform ${process?.platform}`);
      reject(new Error(`Couldn't find ${wkhtmltopdfPath}`));
    }

    const stderrMessages: string[] = [];
    const buffer: Uint8Array[] = [];

    const params = [
      `--orientation ${props.orientation ?? "Portrait"}`,
      `--margin-top ${props.marginTop ?? 0}`,
      `--margin-right ${props.marginRight ?? 0}`,
      `--margin-bottom ${props.marginBottom ?? 0}`,
      `--margin-left ${props.marginLeft ?? 0}`,
      "--disable-smart-shrinking",
      "--disable-javascript",
      "--custom-header-propagation",
      "--log-level warn",
      "--image-dpi 200",
      "--image-quality 75",
      '--footer-right "Page [page] of [topage]"',
      "--footer-font-size 8",
      "--enable-local-file-access",
    ];

    console.log(
      "Generating pdf from " + (input instanceof Stream ? "a stream" : `an URI: '${input}'`)
    );
    console.debug("Wkhtmltopdf options", params);

    const args = [
      wkhtmltopdfPath,
      ...params,
      input instanceof Stream ? "-" : input,
      "-", // output, '-' for stream
    ].join(" ");

    console.debug("Executing", args);

    const proc = spawn("/bin/bash", ["-c", `set -o pipefail ; ${args} | cat`]);

    proc
      .on("error", error => {
        reject(error);
      })
      .on("exit", code => {
        if (code) {
          reject(new Error(`wkhtmltopdf exited with code ${code}, ${stderrMessages.join()}`));
        } else {
          resolve(Buffer.concat(buffer));
        }
      });

    proc.stdout
      .on("data", data => {
        buffer.push(data);
      })
      .on("error", error => {
        reject(error);
      });

    proc.stderr?.on("data", data => {
      stderrMessages.push((data || "").toString());
      console.error(data.toString());
    });

    if (input instanceof Stream) {
      input.pipe(proc.stdin);
    }
  });
}

export default wkHtmlToPdf;
