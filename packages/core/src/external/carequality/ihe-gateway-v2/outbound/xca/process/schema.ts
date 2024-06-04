import { z } from "zod";

const slot = z.object({
  ValueList: z.object({
    Value: z.union([z.string(), z.number()]), // this should probably support a list too
  }),
  _name: z.string(),
});
export type Slot = z.infer<typeof slot>;

const name = z.object({
  LocalizedString: z.object({
    _charset: z.string(),
    _value: z.string(),
  }),
});
export type Name = z.infer<typeof name>;

const classification = z.object({
  Slot: z.union([slot, z.array(slot)]),
  Name: name.optional(),
  _classificationScheme: z.string(),
  _classifiedObject: z.string(),
  _id: z.string(),
  _nodeRepresentation: z.string(),
  _objectType: z.literal(
    "urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:Classification"
  ),
});
export type Classification = z.infer<typeof classification>;

const externalIdentifier = z.object({
  Name: name.optional(),
  _id: z.string(),
  _identificationScheme: z.string(),
  _objectType: z.literal(
    "urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:ExternalIdentifier"
  ),
  _registryObject: z.string(),
  _value: z.string(),
});
export type ExternalIdentifier = z.infer<typeof externalIdentifier>;

export const extrinsicObject = z.object({
  Slot: z.union([slot, z.array(slot)]),
  Name: name.optional(),
  Classification: z.union([classification, z.array(classification)]),
  ExternalIdentifier: z.array(externalIdentifier),
  _home: z.string(),
  _id: z.string(),
  _isOpaque: z.string(),
  _mimeType: z.string(),
  _objectType: z.string(),
  _status: z.string(),
});
export type ExtrinsicObject = z.infer<typeof extrinsicObject>;

export const registryError = z.object({
  _codeContext: z.string().optional(),
  _errorCode: z.string().optional(),
  _severity: z.string().optional(),
});
export type RegistryError = z.infer<typeof registryError>;

const registryErrorList = z.object({
  RegistryError: z.union([registryError, z.array(registryError)]),
  _highestSeverity: z.string(),
});
export type RegistryErrorList = z.infer<typeof registryErrorList>;

export const iti38Body = z.object({
  AdhocQueryResponse: z.object({
    RegistryErrorList: registryErrorList.optional(),
    RegistryObjectList: z
      .union([
        z.object({
          ExtrinsicObject: z.union([extrinsicObject, z.array(extrinsicObject)]),
        }),
        z.literal(""),
      ])
      .optional(),
    _status: z.string(),
    _totalResultCount: z.string().optional(),
  }),
});

export const iti38Schema = z.object({
  Envelope: z.object({
    Header: z.any(),
    Body: iti38Body,
  }),
});

export type Iti38Response = z.infer<typeof iti38Schema>;
