package com.metriport;

import com.metriport.generated.Metriport;
import com.metriport.generated.core.RequestOptions;
import com.metriport.generated.resources.medical.fhir.types.ConsolidatedBundleUpload;
import com.metriport.generated.resources.medical.fhir.requests.GetPatientConsolidatedData;
import com.fasterxml.jackson.core.JsonProcessingException;


import io.github.cdimascio.dotenv.Dotenv;
import org.junit.jupiter.api.Test;
import com.metriport.generated.core.ApiError;

import java.util.concurrent.TimeUnit;

public class TestStartConsolidatedQuery {
    @Test
    public void startConsolidatedQuery() {
        Dotenv dotenv = Dotenv.load();

        String apiKey = dotenv.get("API_KEY");
        String patientId = dotenv.get("PATIENT_ID");
        String baseUrl = dotenv.get("BASE_URL");

        Metriport client = Metriport.builder()
                .apiKey(apiKey)
                .url(baseUrl)
                .build();

        System.out.println("Calling start_consolidated_query...");

        try {
            // Initialize RequestOptions

            GetPatientConsolidatedData request = GetPatientConsolidatedData.builder()
                .resources("Encounter")
                .dateFrom("2022-01-01")
                .dateTo("2022-12-31")
                .conversionType("pdf")
                .build();

            // Now, pass requestOptions to the method call
            var response = client.medical().fhir().startConsolidatedQuery(patientId, request);
            System.out.println("response: " + response);
        } catch (ApiError error) {
            System.err.println("API error: " + error.getMessage());
            error.printStackTrace();
        } catch (RuntimeException e) {
            System.err.println("Runtime exception: " + e.getMessage());
            e.printStackTrace();
        } catch (Exception e) {
            System.err.println("General exception: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
