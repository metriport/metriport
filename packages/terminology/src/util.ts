import { MetriportError } from "@metriport/shared";
import { NextFunction, Request, Response } from "express";

const normalizationErrorMsg = "Invalid NDC code";

export function asyncHandler(
  f: (
    req: Request,
    res: Response,
    next: NextFunction
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<Response<any, Record<string, any>> | void>
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await f(req, res, next);
    } catch (err) {
      console.log(`${JSON.stringify(err)}`);
      next(err);
    }
  };
}

/**
 * Normalizes NDC codes to the 11-digit HIPAA format as per the [NLM HIPAA NDC Specification](https://www.nlm.nih.gov/research/umls/rxnorm/docs/techdoc.html#s1_0:~:text=6.0%20Normalizing%20NDC%20codes%20in%20RxNorm).
 *
 * For hyphenated codes (e.g. 12345-6789-01):
 * - Labeler (first segment):
 *   - 6 digits: remove leading zero
 *   - 5 digits: keep as is
 *   - 4 digits: add leading zero
 * - Product (second segment):
 *   - 4 digits: keep as is
 *   - 3 digits: add leading zero
 * - Package (third segment):
 *   - 2 digits: keep as is
 *   - 1 digit: add leading zero
 *
 * For non-hyphenated codes:
 * - 12 digits: remove leading zero
 * - 11 digits: keep as is
 * - 10 digits: add leading zero
 */
export function normalizeNdcCode(ndc: string, isTruncatedAllowed = false): string {
  const cleaned = ndc.trim().replace(/\*/g, "0");
  let normalized = "";

  if (cleaned.includes("-")) {
    const [labeler, product, pkg] = cleaned.split("-");
    if (!labeler || !product)
      throw new MetriportError(normalizationErrorMsg, undefined, {
        cleaned,
        reason: "missing labeler or product",
      });
    if (!pkg && !isTruncatedAllowed)
      throw new MetriportError(normalizationErrorMsg, undefined, {
        cleaned,
        reason: "missing package",
      });

    if (labeler.length === 6) {
      normalized += labeler.slice(1);
    } else if (labeler.length === 5) {
      normalized += labeler;
    } else if (labeler.length === 4) {
      normalized += `0${labeler}`;
    } else {
      throw new MetriportError(normalizationErrorMsg, undefined, {
        cleaned,
        reason: "invalid labeler length",
      });
    }

    if (product.length === 4) {
      normalized += product;
    } else if (product.length === 3) {
      normalized += `0${product}`;
    } else {
      throw new MetriportError(normalizationErrorMsg, undefined, {
        cleaned,
        reason: "invalid product length",
      });
    }

    if (pkg && pkg.length === 2) {
      normalized += pkg;
    } else if (pkg && pkg.length === 1) {
      normalized += `0${pkg}`;
    } else {
      if (!isTruncatedAllowed) {
        throw new MetriportError(normalizationErrorMsg, undefined, {
          cleaned,
          reason: "invalid package length",
        });
      }
    }

    return normalized;
  }

  if (cleaned.length === 12) {
    return cleaned.slice(1);
  } else if (cleaned.length === 11) {
    return cleaned;
  } else if (cleaned.length === 10) {
    return `0${cleaned}`;
  } else {
    throw new MetriportError(normalizationErrorMsg, undefined, {
      cleaned,
      reason: "invalid length",
    });
  }
}
