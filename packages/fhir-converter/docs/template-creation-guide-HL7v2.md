⚠ **This document applies to the Handlebars engine. Follow [this](https://github.com/microsoft/FHIR-Converter/tree/dotliquid) link for the documentation of Liquid engine.** <br></br>

# HL7 v2 template creation

In this how-to-guide, we will cover how to create templates for converting HL7 v2 messages into FHIR bundles. For more general guidance on creating templates, see the [Template Creation Guide](template-creation-how-to-guide.md).

The HL7 v2 templates included in the release were created by generating the data from [Google spreadsheets](https://docs.google.com/spreadsheets/d/1PaFYPSSq4oplTvw_4OgOn6h2Bs_CMvCAU9CqC4tPBgk) created by the HL7 community as part of their [V2 to FHIR mapping project](https://confluence.hl7.org/display/OO/2-To-FHIR+Project) which describes the mapping of HL7 v2 version 2.8.2 into FHIR bundles version R4. We will add more templates as the HL7 community defines them.

Right now for HL7 v2, we have top level templates for ADT_A01 (admit message), OML_021 (lab order message), ORU_R01 (observation result message), and VXU_V04 (vaccination update message). There are partial templates available for Data Types, Resources, References and Code Systems. For more information on these types of partial templates, see the [Partial Template Guide](partial-template-concept.md).

## Getting started

To get started updating/creating HL7 v2 templates:

1. Load or paste in the sample message that you are using to validate your template. When modifying and creating templates, it’s helpful to have your sample message loaded so that you are able to see the FHIR results real time as you’re editing.

![load message](images/load-message.png)

2. Load your starting template or clear the template editing section. Rename the template and hit save so that your new template work doesn’t overwrite an existing template.

![load template](images/load-template.png)

3. As you make updates in the left-hand editor, you will see the results of those reflected on the right-hand side.

**TIP**: When editing templates, auto-completion is available for common scenarios to help you pull in commands, helper functions, and template names. To pull these in, start with {{. If you need to pull a partial template, type {{>.

4. To ensure that you have included all of the needed message parts in your FHIR bundle, any segment that is not referenced by the template will be underlined in red dots (…). Review the elements underlined in red to ensure you have accounted for all necessary segments.

![web UI](images/full-ui.png)

**NOTE**: The red dot underline functionality checks if the data is referenced in the template and does not guarantee that the specific value is directly included (or included at all) in the FHIR bundle output. Examples of this are any element used to generate the unique ID using the helper function generateUUID will count as included in the FHIR bundle output and any element referenced as part of an if statement will count as included, even if the if condition is not satisfied.

5. Once you are done editing, make sure to hit save. Your template will now be available to be called by the API for real time message translation.

For more details, see some of our additional conceptual guides and resources:

- [Template Creation Guide](template-creation-how-to-guide.md)
- [Partial template concept](partial-template-concept.md)
- [Helper function concept](using-helpers-concept.md)
- [List of helper functions](helper-function-summary.md)
- [Web UI functionality](web-ui-summary.md)
