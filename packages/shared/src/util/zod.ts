import { validDateOfBirthStringSchema as validDateOfBirthStringSchemaFromExternal } from "../external/zod/date";
import {
  defaultNameStringSchema as defaultNameStringSchemaFromExternal,
  defaultOptionalStringSchema as defaultOptionalStringSchemaFromExternal,
  defaultStringSchema as defaultStringSchemaFromExternal,
} from "../external/zod/string";
import { defaultZipStringSchema as defaultZipStringSchemaFromExternal } from "../external/zod/zip";

/** @deprecated Use defaultStringSchema from @metriport/shared/external/zod/string.ts instead */
export const defaultStringSchema = defaultStringSchemaFromExternal;

/** @deprecated Use defaultOptionalStringSchema from @metriport/shared/external/zod/string.ts instead */
export const defaultOptionalStringSchema = defaultOptionalStringSchemaFromExternal;

/** @deprecated Use validDateOfBirthStringSchema from @metriport/shared/external/zod/date.ts instead */
export const validDateOfBirthStringSchema = validDateOfBirthStringSchemaFromExternal;

/** @deprecated Use defaultNameStringSchema from @metriport/shared/external/zod/string.ts instead */
export const defaultNameStringSchema = defaultNameStringSchemaFromExternal;

/** @deprecated Use defaultZipStringSchema from @metriport/shared/external/zod/zip.ts instead */
export const defaultZipStringSchema = defaultZipStringSchemaFromExternal;
