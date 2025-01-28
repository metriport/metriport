/**
 * From https://github.com/hkarask/html-to-pdf-lambda
 */
import { spawn } from "child_process";
import { existsSync } from "fs";
import { Stream } from "node:stream";
import { WkOptions } from "./types";

/**
 * Converts HTML to PDF using wkhtmltopdf installed in the system/OS.
 * See https://github.com/hkarask/html-to-pdf-lambda for reference.
 *
 * NOTE: wkhtmltopdf uses an older version of webkit, so modern CSS might not get rendered as
 * expected. Use http://www.cssdrive.com/cssautoprefixer/ to adjust your CSS to be compatible.
 *
 * @param props - Options for wkhtmltopdf (see https://wkhtmltopdf.org/usage/wkhtmltopdf.txt)
 * @param input - HTML to convert to PDF, can be a string or a stream
 * @param log - Optional logger
 * @returns Promise resolving to the PDF buffer
 */
export function wkHtmlToPdf(
  props: WkOptions,
  input: string | Stream,
  log?: typeof console.log | undefined
): Promise<Buffer> {
  const { removeBackground = true, grayscale = true } = props;
  return new Promise<Buffer>((resolve, reject) => {
    let wkhtmltopdfPath = "/opt/bin/wkhtmltopdf";

    if (process.platform === "darwin") {
      wkhtmltopdfPath = "/usr/local/bin/wkhtmltopdf";
    }

    if (!existsSync(wkhtmltopdfPath)) {
      log && log(`Couldn't find ${wkhtmltopdfPath} - platform ${process?.platform}`);
      reject(new Error(`Couldn't find ${wkhtmltopdfPath}`));
    }

    const stderrMessages: string[] = [];
    const buffer: Uint8Array[] = [];

    // From https://wkhtmltopdf.org/usage/wkhtmltopdf.txt
    const params = [
      `--orientation ${props.orientation ?? "Portrait"}`,
      `--page-size ${props.pageSize ?? "A4"}`,
      ...(props.marginTop ? [`--margin-top ${props.marginTop ?? 0}`] : []),
      ...(props.marginRight ? [`--margin-right ${props.marginRight ?? 0}`] : []),
      ...(props.marginBottom ? [`--margin-bottom ${props.marginBottom ?? 0}`] : []),
      ...(props.marginLeft ? [`--margin-left ${props.marginLeft ?? 0}`] : []),
      ...(grayscale ? ["--grayscale"] : []),
      ...(removeBackground ? ["--no-background"] : []),
      "--disable-javascript",
      "--custom-header-propagation",
      "--log-level warn",
      "--enable-local-file-access",
    ];

    log &&
      log("Generating pdf from " + (input instanceof Stream ? "a stream" : `an URI: '${input}'`));
    log && log("Wkhtmltopdf options", params);

    const args = [
      wkhtmltopdfPath,
      ...params,
      input instanceof Stream ? "-" : input,
      "-", // output, '-' for stream
    ].join(" ");

    log && log("Executing", args);

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
