package com.metriport;

import com.metriport.generated.Metriport;
import com.metriport.generated.resources.fhir.types.Coding;
import com.metriport.generated.resources.fhir.types.CodeableConcept;
import com.metriport.generated.resources.medical.document.requests.UploadDocumentRequest;
import com.metriport.generated.resources.fhir.types.Period;
import com.metriport.generated.resources.fhir.types.Attachment;
import com.metriport.generated.resources.fhir.types.DocumentReferenceContent;
import com.metriport.generated.resources.fhir.types.DocumentReferenceContext;
import com.metriport.generated.resources.fhir.types.DocumentReference;


import org.junit.jupiter.api.Test;
import io.github.cdimascio.dotenv.Dotenv;

import java.util.Collections;

public class TestCreateDocumentReference {

    @Test
    public void test_start_doc_query() {
        Dotenv dotenv = Dotenv.load();
        Metriport client = Metriport.builder()
                .apiKey(dotenv.get("API_KEY"))
                .url(dotenv.get("BASE_URL"))
                .build();

        Coding coding = Coding.builder()
                .system("http://loinc.org")
                .code("3141-9")
                .display("Body weight Measured")
                .build();

        CodeableConcept typeCodeableConcept = CodeableConcept.builder()
                .coding(Collections.singletonList(coding))
                .build();

        CodeableConcept facilityType = CodeableConcept.builder()
                .text("John Snow Clinic - Acute Care Centre")
                .build();

        Period period = Period.builder()
                .start("2023-10-10T14:14:17Z")
                .end("2023-10-10T15:30:30Z")
                .build();

        DocumentReferenceContext documentReferenceContext = DocumentReferenceContext.builder()
                .period(period)
                .facilityType(facilityType)
                .build();

        Attachment attachment = Attachment.builder().build();

        DocumentReferenceContent documentReferenceContent = DocumentReferenceContent.builder()
                .attachment(attachment)
                .build();

        DocumentReference uploadDocumentReference = DocumentReference.builder()
                .resourceType("DocumentReference")
                .type(typeCodeableConcept)
                .context(Collections.singletonList(documentReferenceContext))
                .content(Collections.singletonList(documentReferenceContent))
                .build();

        UploadDocumentRequest uploadDocumentRequest = UploadDocumentRequest.builder()
                .patientId(dotenv.get("PATIENT_ID"))
                .body(uploadDocumentReference)
                .build();

        var response = client.medical().document().createDocumentReference(uploadDocumentRequest);

        System.out.println("Response: " + response);
    }
}