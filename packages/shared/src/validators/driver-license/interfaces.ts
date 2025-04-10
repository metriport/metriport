/**
 * Country formats.
 */
export interface CountryFormats {
  [index: string]: DriverLicenseFormat[];
}

/**
 * Driver license format.
 */
export interface DriverLicenseFormat {
  regex: RegExp;
  description: string;
}

/**
 * Validation match results.
 */
export interface ValidationMatch {
  state: string;
  description: string;
}

/**
 * Supported country codes.
 */
export type CountryCode = 'US' | 'CA';

/**
 * Validate options.
 */
export interface ValidateOptions {
  country?: CountryCode;
  states?: string | string[];
  ignoreCase?: boolean;
}
