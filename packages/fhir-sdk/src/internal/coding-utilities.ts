import { inspect } from "util";
import { Coding, CodeableConcept } from "@medplum/fhirtypes";
import { SmartCoding, SmartCodeableConcept } from "../types/smart-resources";
import { CODING_SYSTEM_CONFIG } from "./coding-systems";

/**
 * Cache for smart coding objects to maintain object identity
 */
const smartCodingCache = new WeakMap<Coding, SmartCoding>();

/**
 * Cache for smart codeable concept objects to maintain object identity
 */
const smartCodeableConceptCache = new WeakMap<CodeableConcept, SmartCodeableConcept>();

/**
 * Type guard to check if a value is an Identifier object
 * Identifiers have system like Coding, but also have use/value/period/assigner
 * We check for system AND at least one Identifier-specific property to avoid false positives
 */
export function isIdentifier(value: unknown): value is import("@medplum/fhirtypes").Identifier {
  if (typeof value !== "object" || value === null || Array.isArray(value) || !("system" in value)) {
    return false;
  }

  // Must have system (shared with Coding) AND at least one Identifier-specific property
  return "use" in value || "assigner" in value || ("value" in value && "period" in value);
}

/**
 * Type guard to check if a value is a CodeableConcept object
 * Must check this BEFORE isCoding since both can have overlapping properties
 */
export function isCodeableConcept(value: unknown): value is CodeableConcept {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    ("coding" in value || "text" in value) &&
    // Exclude Reference objects which also have optional text
    !("reference" in value) &&
    // Exclude Identifier objects
    !isIdentifier(value)
  );
}

/**
 * Type guard to check if a value is a Coding object
 * Check for Coding-specific properties and exclude CodeableConcept and Identifier
 */
export function isCoding(value: unknown): value is Coding {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    ("system" in value || "display" in value) &&
    // Make sure it's not a CodeableConcept
    !("coding" in value || "text" in value) &&
    // Make sure it's not an Identifier (which also has system)
    !isIdentifier(value)
  );
}

/**
 * Helper function to check if a coding belongs to a specific system
 */
function isSystem(coding: Coding, systemUrl: string): boolean {
  return coding.system === systemUrl;
}

/**
 * Helper function to check if a coding's code matches a specific value
 */
function matchesCode(coding: Coding, code: string): boolean {
  return coding.code === code;
}

/**
 * Helper function to check if a coding's code matches any of the provided values
 */
function matchesCodes(coding: Coding, codes: string[]): boolean {
  return coding.code !== undefined && codes.includes(coding.code);
}

/**
 * Get all virtual method names for SmartCoding
 */
function getSmartCodingVirtualMethods(): string[] {
  const methods: string[] = [];
  for (const { systemName } of CODING_SYSTEM_CONFIG) {
    methods.push(`is${systemName}`);
  }
  methods.push("matchesCode", "matchesCodes");
  return methods;
}

/**
 * Get all virtual method names for SmartCodeableConcept
 */
function getSmartCodeableConceptVirtualMethods(): string[] {
  const methods: string[] = [];
  for (const { systemName } of CODING_SYSTEM_CONFIG) {
    methods.push(
      `get${systemName}`,
      `get${systemName}Codings`,
      `get${systemName}Code`,
      `get${systemName}Codes`,
      `has${systemName}`,
      `has${systemName}Code`,
      `hasSome${systemName}`,
      `find${systemName}Coding`
    );
  }
  return methods;
}

/**
 * Create a SmartCoding proxy with enhanced methods for checking coding systems
 */
export function createSmartCoding(coding: Coding): SmartCoding {
  // Check cache first to maintain object identity
  const cached = smartCodingCache.get(coding);
  if (cached) {
    return cached;
  }

  const virtualMethods = getSmartCodingVirtualMethods();

  const smartCoding = new Proxy(coding, {
    get: (target, prop, receiver) => {
      // Handle system checking methods
      for (const { systemName, systemUrl } of CODING_SYSTEM_CONFIG) {
        if (prop === `is${systemName}`) {
          return () => isSystem(target, systemUrl);
        }
      }

      // Handle code matching methods
      if (prop === "matchesCode") {
        return (code: string) => matchesCode(target, code);
      }

      if (prop === "matchesCodes") {
        return (codes: string[]) => matchesCodes(target, codes);
      }

      // Handle Symbol.toStringTag for better console display
      if (prop === Symbol.toStringTag) {
        return "SmartCoding";
      }

      // Handle toJSON for serialization
      if (prop === "toJSON") {
        return () => target;
      }

      // Handle Node.js util.inspect.custom for console.log
      if (prop === inspect.custom) {
        return () => target;
      }

      // Return original property
      return Reflect.get(target, prop, receiver);
    },

    ownKeys: target => {
      const keys = Reflect.ownKeys(target);
      return [...keys, ...virtualMethods];
    },

    getOwnPropertyDescriptor: (target, prop) => {
      if (typeof prop === "string" && virtualMethods.includes(prop)) {
        return {
          enumerable: true,
          configurable: true,
          writable: false,
        };
      }
      if (prop === Symbol.toStringTag || prop === "toJSON" || prop === inspect.custom) {
        return undefined;
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  }) as SmartCoding;

  // Cache the smart coding
  smartCodingCache.set(coding, smartCoding);

  return smartCoding;
}

/**
 * Helper functions for CodeableConcept methods
 */
function getFirstCodingForSystem(
  codings: Coding[] | undefined,
  systemUrl: string
): SmartCoding | undefined {
  if (!codings) {
    return undefined;
  }
  const coding = codings.find(c => c.system === systemUrl);
  return coding ? createSmartCoding(coding) : undefined;
}

function getAllCodingsForSystem(codings: Coding[] | undefined, systemUrl: string): SmartCoding[] {
  if (!codings) {
    return [];
  }
  return codings.filter(c => c.system === systemUrl).map(c => createSmartCoding(c));
}

function getFirstCodeForSystem(
  codings: Coding[] | undefined,
  systemUrl: string
): string | undefined {
  if (!codings) {
    return undefined;
  }
  const coding = codings.find(c => c.system === systemUrl);
  return coding?.code;
}

function getAllCodesForSystem(codings: Coding[] | undefined, systemUrl: string): string[] {
  if (!codings) {
    return [];
  }
  return codings
    .filter(c => c.system === systemUrl)
    .map(c => c.code)
    .filter((c): c is string => c !== undefined);
}

function hasAnyForSystem(codings: Coding[] | undefined, systemUrl: string): boolean {
  if (!codings) {
    return false;
  }
  return codings.some(c => c.system === systemUrl);
}

function hasSpecificCodeForSystem(
  codings: Coding[] | undefined,
  systemUrl: string,
  code: string
): boolean {
  if (!codings) {
    return false;
  }
  return codings.some(c => c.system === systemUrl && c.code === code);
}

function hasSomeCodesForSystem(
  codings: Coding[] | undefined,
  systemUrl: string,
  codes: string[]
): boolean {
  if (!codings) {
    return false;
  }
  return codings.some(
    c => c.system === systemUrl && c.code !== undefined && codes.includes(c.code)
  );
}

function findCodingForSystem(
  codings: Coding[] | undefined,
  systemUrl: string,
  predicate: (code: string) => boolean
): SmartCoding | undefined {
  if (!codings) {
    return undefined;
  }
  const coding = codings.find(
    c => c.system === systemUrl && c.code !== undefined && predicate(c.code)
  );
  return coding ? createSmartCoding(coding) : undefined;
}

/**
 * Create a SmartCodeableConcept proxy with enhanced methods for working with coding systems
 */
export function createSmartCodeableConcept(concept: CodeableConcept): SmartCodeableConcept {
  // Check cache first to maintain object identity
  const cached = smartCodeableConceptCache.get(concept);
  if (cached) {
    return cached;
  }

  const virtualMethods = getSmartCodeableConceptVirtualMethods();

  const smartConcept = new Proxy(concept, {
    get: (target, prop, receiver) => {
      // Handle coding array - wrap each Coding in SmartCoding
      if (prop === "coding" && target.coding) {
        return target.coding.map(c => createSmartCoding(c));
      }

      // Generate methods for each coding system
      for (const { systemName, systemUrl } of CODING_SYSTEM_CONFIG) {
        if (prop === `get${systemName}`) {
          return () => getFirstCodingForSystem(target.coding, systemUrl);
        }
        if (prop === `get${systemName}Codings`) {
          return () => getAllCodingsForSystem(target.coding, systemUrl);
        }
        if (prop === `get${systemName}Code`) {
          return () => getFirstCodeForSystem(target.coding, systemUrl);
        }
        if (prop === `get${systemName}Codes`) {
          return () => getAllCodesForSystem(target.coding, systemUrl);
        }
        if (prop === `has${systemName}`) {
          return () => hasAnyForSystem(target.coding, systemUrl);
        }
        if (prop === `has${systemName}Code`) {
          return (code: string) => hasSpecificCodeForSystem(target.coding, systemUrl, code);
        }
        if (prop === `hasSome${systemName}`) {
          return (codes: string[]) => hasSomeCodesForSystem(target.coding, systemUrl, codes);
        }
        if (prop === `find${systemName}Coding`) {
          return (predicate: (code: string) => boolean) =>
            findCodingForSystem(target.coding, systemUrl, predicate);
        }
      }

      // Handle Symbol.toStringTag for better console display
      if (prop === Symbol.toStringTag) {
        return "SmartCodeableConcept";
      }

      // Handle toJSON for serialization
      if (prop === "toJSON") {
        return () => target;
      }

      // Handle Node.js util.inspect.custom for console.log
      if (prop === inspect.custom) {
        return () => target;
      }

      // Return original property
      return Reflect.get(target, prop, receiver);
    },

    ownKeys: target => {
      const keys = Reflect.ownKeys(target);
      return [...keys, ...virtualMethods];
    },

    getOwnPropertyDescriptor: (target, prop) => {
      if (typeof prop === "string" && virtualMethods.includes(prop)) {
        return {
          enumerable: true,
          configurable: true,
          writable: false,
        };
      }
      if (prop === Symbol.toStringTag || prop === "toJSON" || prop === inspect.custom) {
        return undefined;
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  }) as SmartCodeableConcept;

  // Cache the smart codeable concept
  smartCodeableConceptCache.set(concept, smartConcept);

  return smartConcept;
}
