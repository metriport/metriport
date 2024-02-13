package com.metriport;

import com.metriport.generated.Metriport;
import io.github.cdimascio.dotenv.Dotenv;
import org.junit.jupiter.api.Test;

public class TestGetPatient {
    @Test
    public void getAllPatients() {
        Dotenv dotenv = Dotenv.load();

        Metriport metriport = Metriport.builder()
            .apiKey(dotenv.get("API_KEY"))
            .url(dotenv.get("BASE_URL"))
            .build();

        var response = metriport.medical().patient().list();
        System.out.println("Received response!" + response);
    }
    @Test
    public void getSpecificPatient() {
        Dotenv dotenv = Dotenv.load();

        Metriport metriport = Metriport.builder()
            .apiKey(dotenv.get("API_KEY"))
            .url(dotenv.get("BASE_URL"))
            .build();

        var response = metriport.medical().patient().get(dotenv.get("PATIENT_ID"));
        System.out.println("Received response!" + response);
    }

}
