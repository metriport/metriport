package com.metriport;

import com.metriport.generated.Metriport;
import com.metriport.generated.resources.medical.document.types.UploadDocumentReference;
import com.metriport.generated.resources.medical.document.types.Coding;
import com.metriport.generated.resources.medical.document.types.CodeableConcept;
import com.metriport.generated.resources.medical.document.types.DocumentReferenceContext;
import com.metriport.generated.resources.medical.document.requests.UploadDocumentRequest;
import com.metriport.generated.resources.commons.types.Period;

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
                .system("100556-0")
                .code("http://loinc.org")
                .display("Burn management Hospital Progress note")
                .build();

        CodeableConcept typeCodeableConcept = CodeableConcept.builder()
                .text("Burn management Hospital Progress note")
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

        UploadDocumentReference uploadDocumentReference = UploadDocumentReference.builder()
                .description("Third degree wrist burn treatment")
                .type(typeCodeableConcept)
                .context(Collections.singletonList(documentReferenceContext))
                .build();

        UploadDocumentRequest uploadDocumentRequest = UploadDocumentRequest.builder()
                .patientId(dotenv.get("PATIENT_ID"))
                .body(uploadDocumentReference)
                .build();

        var response = client.medical().document().createDocumentReference(uploadDocumentRequest);

        System.out.println("Response: " + response);
    }
}