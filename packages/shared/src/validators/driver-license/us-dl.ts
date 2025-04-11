import { CountryFormats } from './interfaces';

/**
 * USA driver license formats.
 */
export const US_DL: CountryFormats = {
  AL: [
    {
      regex: /^[0-9]{1,8}$/,
      description: '1-8 numbers',
    },
  ],
  AK: [
    {
      regex: /^[0-9]{1,7}$/,
      description: '1-7 numbers',
    },
  ],
  AZ: [
    {
      regex: /^[A-Z]{1}[0-9]{8,9}$/,
      description: '1 letter followed by 8-9 numbers',
    },
    {
      regex: /^[A-Z]{2}[0-9]{2,5}$/,
      description: '2 letters followed by 2-5 numbers',
    },
    {
      regex: /^[0-9]{9}$/,
      description: '9 numbers',
    },
  ],
  AR: [
    {
      regex: /^[0-9]{4,9}$/,
      description: '4-9 numbers',
    },
  ],
  CA: [
    {
      regex: /^[A-Z]{1}[0-9]{7}$/,
      description: '1 letter followed by 7 numbers',
    },
  ],
  CO: [
    {
      regex: /^[0-9]{9}$/,
      description: '9 numbers',
    },
    {
      regex: /^[A-Z]{1}[0-9]{3,6}$/,
      description: '1 letter followed by 3-6 numbers',
    },
    {
      regex: /^[A-Z]{2}[0-9]{2,5}$/,
      description: '2 letters followed by 2-5 numbers',
    },
  ],
  CT: [
    {
      regex: /^[0-9]{9}$/,
      description: '9 numbers',
    },
  ],
  DE: [
    {
      regex: /^[0-9]{1,7}$/,
      description: '1-7 numbers',
    },
  ],
  DC: [
    {
      regex: /^[0-9]{7}$/,
      description: '7 numbers',
    },
    {
      regex: /^[0-9]{9}$/,
      description: '9 numbers',
    },
  ],
  FL: [
    {
      regex: /^[A-Z]{1}[0-9]{12}$/,
      description: '1 letter followed by 12 numbers',
    },
  ],
  GA: [
    {
      regex: /^[0-9]{7,9}$/,
      description: '7-9 numbers',
    },
  ],
  HI: [
    {
      regex: /^[A-Z]{1}[0-9]{8}$/,
      description: '1 letter followed by 8 numbers',
    },
    {
      regex: /^[0-9]{9}$/,
      description: '9 numbers',
    },
  ],
  ID: [
    {
      regex: /^[A-Z]{2}[0-9]{6}[A-Z]{1}$/,
      description: '2 letters followed by 6 numbers followed by 1 letter',
    },
    {
      regex: /^[0-9]{9}$/,
      description: '9 numbers',
    },
  ],
  IL: [
    {
      regex: /^[A-Z]{1}[0-9]{11,12}$/,
      description: '1 letter followed by 11-12 numbers',
    },
  ],
  IN: [
    {
      regex: /^[A-Z]{1}[0-9]{9}$/,
      description: '1 letter followed by 9 numbers',
    },
    {
      regex: /^[0-9]{9,10}$/,
      description: '9-10 numbers',
    },
  ],
  IA: [
    {
      regex: /^[0-9]{9}$/,
      description: '9 numbers',
    },
    {
      regex: /^[0-9]{3}[A-Z]{2}[0-9]{4}$/,
      description: '3 numbers followed by 2 letters followed by 4 numbers',
    },
  ],
  KS: [
    {
      regex: /^([A-Z]{1}[0-9]{1}){2}[A-Z]{1}$/,
      description: '1 letter then 1 number then 1 letter then 1 number then 1 letter',
    },
    {
      regex: /^[A-Z]{1}[0-9]{8}$/,
      description: '1 letter followed by 8 numbers',
    },
    {
      regex: /^[0-9]{9}$/,
      description: '9 numbers',
    },
  ],
  KY: [
    {
      regex: /^[A-Z]{1}[0-9]{8,9}$/,
      description: '1 letter followed by 8-9 numbers',
    },
    {
      regex: /^[0-9]{9}$/,
      description: '9 numbers',
    },
  ],
  LA: [
    {
      regex: /^[0-9]{1,9}$/,
      description: '1-9 numbers',
    },
  ],
  ME: [
    {
      regex: /^[0-9]{7}$/,
      description: '7 numbers',
    },
    {
      regex: /^[0-9]{7}[A-Z]{1}$/,
      description: '7 numbers followed by 1 letter',
    },
    {
      regex: /^[0-9]{8}$/,
      description: '8 numbers',
    },
  ],
  MD: [
    {
      regex: /^[A-Z]{1}[0-9]{12}$/,
      description: '1 letter followed by 12 numbers',
    },
  ],
  MA: [
    {
      regex: /^[A-Z]{1}[0-9]{8}$/,
      description: '1 letter followed by 8 numbers',
    },
    {
      regex: /^[A-Z]{2}[0-9]{7}$/,
      description: '2 letters followed by 7 numbers',
    },
    {
      regex: /^[0-9]{9}$/,
      description: '9 numbers',
    },
  ],
  MI: [
    {
      regex: /^[A-Z]{1}[0-9]{10}$/,
      description: '1 letter followed by 10 numbers',
    },
    {
      regex: /^[A-Z]{1}[0-9]{12}$/,
      description: '1 letter followed by 12 numbers',
    },
  ],
  MN: [
    {
      regex: /^[A-Z]{1}[0-9]{12}$/,
      description: '1 letter followed by 12 numbers',
    },
  ],
  MS: [
    {
      regex: /^[0-9]{9}$/,
      description: '9 numbers',
    },
  ],
  MO: [
    {
      regex: /^[A-Z]{1}[0-9]{5,9}$/,
      description: '1 letter followed by 5-9 numbers',
    },
    {
      regex: /^[A-Z]{1}[0-9]{6}[R]$/,
      description: '1 letter followed by 6 numbers followed by "R"',
    },
    {
      regex: /^[0-9]{8}[A-Z]{2}$/,
      description: '8 numbers followed by 2 letters',
    },
    {
      regex: /^[0-9]{9}[A-Z]{1}$/,
      description: '9 numbers followed by 1 letter',
    },
    {
      regex: /^[0-9]{9}$/,
      description: '9 numbers',
    },
  ],
  MT: [
    {
      regex: /^[A-Z]{1}[0-9]{8}$/,
      description: '1 letter followed by 8 numbers',
    },
    {
      regex: /^[0-9]{13}$/,
      description: '13 numbers',
    },
    {
      regex: /^[0-9]{9}$/,
      description: '9 numbers',
    },
    {
      regex: /^[0-9]{14}$/,
      description: '14 numbers',
    },
  ],
  NE: [
    {
      regex: /^[A-Z]{1}[0-9]{6,8}$/,
      description: '1 letter followed by 6-8 numbers',
    },
  ],
  NV: [
    {
      regex: /^[0-9]{9,10}$/,
      description: '9-10 numbers',
    },
    {
      regex: /^[0-9]{12}$/,
      description: '12 numbers',
    },
    {
      regex: /^[X]{1}[0-9]{8}$/,
      description: '"X" followed by 8 numbers',
    },
  ],
  NH: [
    {
      regex: /^[0-9]{2}[A-Z]{3}[0-9]{5}$/,
      description: '2 numbers followed by 3 letters followed by 5 numbers',
    },
  ],
  NJ: [
    {
      regex: /^[A-Z]{1}[0-9]{14}$/,
      description: '1 letter followed by 14 numbers',
    },
  ],
  NM: [
    {
      regex: /^[0-9]{8,9}$/,
      description: '8-9 numbers',
    },
  ],
  NY: [
    {
      regex: /^[A-Z]{1}[0-9]{7}$/,
      description: '1 letter followed by 7 numbers',
    },
    {
      regex: /^[A-Z]{1}[0-9]{18}$/,
      description: '1 letter followed by 18 numbers',
    },
    {
      regex: /^[0-9]{8,9}$/,
      description: '8-9 numbers',
    },
    {
      regex: /^[0-9]{16}$/,
      description: '16 numbers',
    },
    {
      regex: /^[A-Z]{8}$/,
      description: '8 letters',
    },
  ],
  NC: [
    {
      regex: /^[0-9]{1,12}$/,
      description: '1-12 numbers',
    },
  ],
  ND: [
    {
      regex: /^[A-Z]{3}[0-9]{6}$/,
      description: '3 letters followed by 6 numbers',
    },
    {
      regex: /^[0-9]{9}$/,
      description: '9 numbers',
    },
  ],
  OH: [
    {
      regex: /^[A-Z]{1}[0-9]{4,8}$/,
      description: '1 letter followed by 4-8 numbers',
    },
    {
      regex: /^[A-Z]{2}[0-9]{3,7}$/,
      description: '2 letters followed by 3-7 numbers',
    },
    {
      regex: /^[0-9]{8}$/,
      description: '8 numbers',
    },
  ],
  OK: [
    {
      regex: /^[A-Z]{1}[0-9]{9}$/,
      description: '1 letter followed by 9 numbers',
    },
    {
      regex: /^[0-9]{9}$/,
      description: '9 numbers',
    },
  ],
  OR: [
    {
      regex: /^[0-9]{1,9}$/,
      description: '1-9 numbers',
    },
  ],
  PA: [
    {
      regex: /^[0-9]{8}$/,
      description: '8 numbers',
    },
  ],
  RI: [
    {
      regex: /^[0-9]{7}$/,
      description: '7 numbers',
    },
    {
      regex: /^[A-Z]{1}[0-9]{6}$/,
      description: '1 letter followed by 6 numbers',
    },
  ],
  SC: [
    {
      regex: /^[0-9]{5,11}$/,
      description: '5-11 numbers',
    },
  ],
  SD: [
    {
      regex: /^[0-9]{6,10}$/,
      description: '6-10 numbers',
    },
    {
      regex: /^[0-9]{12}$/,
      description: '12 numbers',
    },
  ],
  TN: [
    {
      regex: /^[0-9]{7,9}$/,
      description: '7-9 numbers',
    },
  ],
  TX: [
    {
      regex: /^[0-9]{7,8}$/,
      description: '7-8 numbers',
    },
  ],
  UT: [
    {
      regex: /^[0-9]{4,10}$/,
      description: '4-10 numbers',
    },
  ],
  VT: [
    {
      regex: /^[0-9]{8}$/,
      description: '8 numbers',
    },
    {
      regex: /^[0-9]{7}[A]$/,
      description: '7 numbers followed by "A"',
    },
  ],
  VA: [
    {
      regex: /^[A-Z]{1}[0-9]{8,11}$/,
      description: '1 letter followed by 8-11 numbers',
    },
    {
      regex: /^[0-9]{9}$/,
      description: '9 numbers',
    },
  ],
  WA: [
    {
      regex: /^(?=.{12}$)[A-Z]{1,7}[A-Z0-9\\*]{4,11}$/,
      description: '1-7 letters followed by any combination of letters, numbers, or "*" for a total of 12 characters',
    },
  ],
  WV: [
    {
      regex: /^[0-9]{7}$/,
      description: '7 numbers',
    },
    {
      regex: /^[A-Z]{1,2}[0-9]{5,6}$/,
      description: '1-2 letters followed by 5-6 numbers',
    },
  ],
  WI: [
    {
      regex: /^[A-Z]{1}[0-9]{13}$/,
      description: '1 letter followed by 13 numbers',
    },
  ],
  WY: [
    {
      regex: /^[0-9]{9,10}$/,
      description: '9-10 numbers',
    },
  ],
};
