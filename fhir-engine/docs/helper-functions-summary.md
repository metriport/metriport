⚠ **This document applies to the Handlebars engine. Follow [this](https://github.com/microsoft/FHIR-Converter/tree/dotliquid) link for the documentation of Liquid engine.** <br></br>

# Helper Functions

The open-source release includes a set of helper functions to assist with template creation. The current list of available helper functions is below. If these do not meet your needs, you can also write your own helper functions. Some of the helper functions are used by both the HL7 v2 to FHIR and C-CDA to FHIR implementation, while others are specific to data type.

## HL7 v2 Specific Helper Functions

| Helper Function       | Description                                                                                   | Syntax                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| getFieldRepeats       | Returns repeat list for a field                                                               | **getFieldRepeats** **_fieldData_**                                                           |
| getFirstSegments      | Returns first instance of the segments                                                        | **getFirstSegments** **_message segment1 segment2 …_**                                        |
| getSegmentLists       | Extract HL7 v2 segments                                                                       | **getSegmentLists** **_message segment1 segment2 …_**                                         |
| getRelatedSegmentList | Given a segment name and index, return the collection of related named segments               | **getRelatedSegmentList** **_message parentSegmentName parentSegmentIndex childSegmentName_** |
| getParentSegment      | Given a child segment name and overall message index, return the first matched parent segment | **getParentSegment** **_message childSegmentName childSegmentIndex parentSegmentName_**       |
| hasSegments           | Check if HL7 v2 message has segments                                                          | **hasSegments** **_message segment1 segment2 …_**                                             |

## C-CDA Specific Helper Functions

| Helper Function                 | Description                                                                                                 | Syntax                                                                                |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| getFirstCdaSections             | Returns first instance (non-alphanumeric chars replace by _'\_'_ in name) of the sections (uses _contains_) | **getFirstCdaSections** **_message_** **_section1_** **_section2_**                   |
| getCdaSectionsLists             | Returns instance list (non-alphanumeric chars replace by _'\_'_ in name) for the given sections             | **getCdaSectionsLists** **_message_** **_section1_** **_section2_**                   |
| getFirstCdaSectionsByTemplateId | Returns first instance (non-alphanumeric chars replace by _'\_'_ in name) of the sections by template id    | **getFirstCdaSectionsByTemplateId** **_message_** **_templateId1_** **_templateId2_** |

## Logical/Comparison Helper Functions

| Helper Function | Description                                   | Syntax               |
| --------------- | --------------------------------------------- | -------------------- |
| eq              | Equals at least one of the values             | **eq** **_x a b …_** |
| ne              | Not equal to any value                        | **ne** **_x a b …_** |
| lt              | Less than                                     | **lt** **_a b_**     |
| gt              | Greater than                                  | **gt** **_a b_**     |
| lte             | Less than or equal                            | **lte** **_a b_**    |
| gte             | Greater than or equal                         | **gte** **_a b_**    |
| not             | Not true                                      | **not** **_x_**      |
| and             | Checks if all input arguments are true        | **and** **_a b …_**  |
| or              | Checks if at least one input argument is true | **or** **_a b…_**    |

## String Helper Functions

| Helper Function      | Description                                                               | Syntax                                                     |
| -------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------- |
| charAt               | Returns char at position index                                            | **charAt** **_string index_**                              |
| strLength            | Returns string length                                                     | **strLength** **_string_**                                 |
| strSlice             | Returns part of string between start and end positions (end not included) | **strSlice** **_string start end_**                        |
| split                | Splits the string based on regex. e.g. (split "a,b,c" ",")                | **split** **_string regex_**                               |
| concat               | Returns the concatenation of provided strings                             | **concat** **_aString bString cString …_**                 |
| replace              | Replaces text in a string using a regular expression                      | **replace** **_string searchRegex replaceStr_**            |
| match                | Returns an array containing matches with a regular expression             | **match** **_string regex_**                               |
| contains             | Returns true if a string includes another string                          | **contains** **_aString_** **_bString_**                   |
| toString             | Converts to string                                                        | **toString** **_object_**                                  |
| toJsonString         | Converts to JSON string                                                   | **toJsonString** **_object_**                              |
| toLower              | Converts string to lower case                                             | **toLower** **_string_**                                   |
| toUpper              | Converts string to upper case                                             | **toUpper** **_string_**                                   |
| base64Encode         | Returns base64 encoded string                                             | **base64Encode** **_string_**                              |
| base64Decode         | Returns base64 decoded string                                             | **base64Decode** **_string_**                              |
| escapeSpecialChars   | Returns string with special chars escaped                                 | **escapeSpecialChars** **_string_**                        |
| unescapeSpecialChars | Returns string after removing escaping of special char                    | **unescapeSpecialChars** **_string_**                      |
| sha1Hash             | Returns sha1 hash (in hex) of given string                                | **sha1Hash** **_string_**                                  |
| gzip                 | Returns compressed string                                                 | **gzip** **_string_** **_inEncoding_** **_outEncoding_**   |
| gunzip               | Returns decompressed string                                               | **gunzip** **_string_** **_inEncoding_** **_outEncoding_** |

## Collection Helper Functions

| Helper Function | Description                                                              | Syntax                          |
| --------------- | ------------------------------------------------------------------------ | ------------------------------- |
| elementAt       | Returns array element at position index                                  | **elementAt** **_array index_** |
| length          | Returns array length                                                     | **length** **_array_**          |
| slice           | Returns part of array between start and end positions (end not included) | **slice** **_array start end_** |
| toArray         | Returns an array created (if needed) from given object                   | **toArray** **_object_**        |

## Mathematical Helper Functions

| Helper Function | Description                                                                                                                                                                                                                              | Syntax                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| isNaN           | Checks if the object is not a number using JavaScript isNaN                                                                                                                                                                              | **isNaN** **_object_** |
| abs             | Returns the absolute value of a number                                                                                                                                                                                                   | **abs** **_a_**        |
| ceil            | Returns the next largest whole number or integer                                                                                                                                                                                         | **ceil** **_a_**       |
| floor           | Returns the largest integer less than or equal to a given number                                                                                                                                                                         | **floor** **_a_**      |
| max             | Returns the largest of zero or more numbers                                                                                                                                                                                              | **max** **_a b …_**    |
| min             | Returns the lowest-valued number passed into it, or NaN if any parameter isn't a number and can't be converted into one                                                                                                                  | **min** **_a b …_**    |
| pow             | Returns the base to the exponent power, that is, base^exponent                                                                                                                                                                           | **pow** **_x y_**      |
| random          | Returns a floating-point, pseudo-random number in the range 0 to less than 1 (inclusive of 0, but not 1) with approximately uniform distribution over that range — which you can then scale to your desired range                        | **random**             |
| round           | Returns the value of a number rounded to the nearest integer                                                                                                                                                                             | **round** **_a_**      |
| sign            | Returns either a positive or negative +/- 1, indicating the sign of a number passed into the argument. If the number passed into is 0, it will return a +/- 0. Note that if the number is positive, an explicit (+) will not be returned | **sign** **_a_**       |
| trunc           | Returns the integer part of a number by removing any fractional digits                                                                                                                                                                   | **trunc** **_a_**      |
| add             | Add two numbers: + number1 number 2                                                                                                                                                                                                      | **add** **_a b_**      |
| subtract        | Subtract second number from the first: - number 1 number 2                                                                                                                                                                               | **subtract** **_a b_** |
| multiply        | Multiply two numbers: \* number1 number2                                                                                                                                                                                                 | **multiply** **_a b_** |
| divide          | Divide first number by the second number: / number1 number2                                                                                                                                                                              | **divide** **_a b_**   |

## DateTime Helper Functions

| Helper Function  | Description                                                                                                    | Syntax                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| addHyphensDate   | Adds hyphens to a date without hyphens                                                                         | **addHyphensDate** **_date_**             |
| now              | Provides current UTC time in YYYYMMDDHHmmssSSS format                                                          | **now**                                   |
| formatAsDateTime | Converts an YYYYMMDDHHmmssSSS string, e.g. 20040629175400000 to dateTime format, e.g. 2004-06-29T17:54:00.000z | **formatAsDateTime** **_dateTimeString_** |

## Miscellaneous Helper Functions

| Helper Function | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Syntax                                |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| assert          | Fails with message if predicate is false                                                                                                                                                                                                                                                                                                                                                                                                                                                  | **assert** **_predicate message_**    |
| evaluate        | Returns template result object                                                                                                                                                                                                                                                                                                                                                                                                                                                            | **evaluate** **_templatePath inObj_** |
| generateUUID    | Generates a GUID based on a URL. _Sometimes it will also be invoked with a message object argument_. It may generate different ids if the source file is read from different platforms, because although semantics are the same, the source files may contain different newline characters. </br></br> Here comes an example, the result of `generateUUID '<ClinicalDocument>\n    <section>...'` and the result of `generateUUID '<ClinicalDocument>\r\n    <section>...'` are not equal | **generateUUID** **_url_**            |
| generateUUIDV2  | Generates a consistent GUID based on a URL. _Sometimes it will also be invoked with a message object argument_. If the input contains any platform related newline characters, such as `\n` or `\r`, the generated GUID will also be consistent by removing these characters. </br></br> Here comes an example, the result of `generateUUIDV2 '<ClinicalDocument>\n    <section>...'` and the result of `generateUUIDV2 '<ClinicalDocument>\r\n    <section>...'` are exactly equal       | **generateUUIDV2** **url**            |
| addHyphensSSN   | Adds hyphens to an SSN without hyphens                                                                                                                                                                                                                                                                                                                                                                                                                                                    | **addHyphensSSN** **_SSN_**           |
