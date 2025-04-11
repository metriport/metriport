import { CountryFormats } from './interfaces';

/**
 * Canada driver license formats.
 */
export const CA_DL: CountryFormats = {
  AB: [
    {
      regex: /^[0-9]{9}$/,
      description: '9 numbers',
    },
  ],
  BC: [
    {
      regex: /^[0-9]{7}$/,
      description: '7 numbers',
    },
  ],
  MB: [
    {
      regex: /^[A-Z0-9]{12}$/,
      description: 'any combination of letters or numbers for a total of 12 characters',
    },
  ],
  NB: [
    {
      regex: /^[0-9]{5,7}$/,
      description: '5-7 numbers',
    },
  ],
  NL: [
    {
      regex: /^[A-Z]{1}[0-9]{9}$/,
      description: '1 letter followed by 9 numbers',
    },
  ],
  NT: [
    {
      regex: /^[0-9]{6}$/,
      description: '6 numbers',
    },
  ],
  NS: [
    {
      regex: /^[A-Z]{5}[0-9]{9}$/,
      description: '5 letters followed by 9 numbers',
    },
  ],
  NU: [
    {
      regex: /^[0-9]{9}$/,
      description: '9 numbers',
    },
  ],
  ON: [
    {
      regex: /^[A-Z]{1}[0-9]{14}$/,
      description: '1 letter followed by 14 numbers',
    },
  ],
  PE: [
    {
      regex: /^[0-9]{5,6}$/,
      description: '5-6 numbers',
    },
  ],
  QC: [
    {
      regex: /^[A-Z]{1}[0-9]{12}$/,
      description: '1 letter followed by 12 numbers',
    },
  ],
  SK: [
    {
      regex: /^[0-9]{8}$/,
      description: '8 numbers',
    },
  ],
  YT: [
    {
      regex: /^[0-9]{10}$/,
      description: '10 numbers',
    },
  ],
};
