# FHIR Converter

Converts health data to/from different formats. Currently it supports CCDA to FHIR conversion.

The converter makes use of templates that define the mappings between different data formats. The templates are written in [Handlebars](https://handlebarsjs.com/) templating language and make use of custom helper functions (`/lib/handlebars-converter/handlebars-helpers.js`), which make it easy to work with CCDA documents.

## Running the FHIR Converter

```
docker-compose up --build
```

Once this completes, you can access the service at http://localhost:8777/
