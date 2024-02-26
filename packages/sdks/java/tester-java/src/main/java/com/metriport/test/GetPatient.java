package com.metriport.test;

import io.github.cdimascio.dotenv.Dotenv;
import com.metriport.api.Metriport;

public class GetPatient {
    public static void getAllPatients(String[] args) {
        Dotenv dotenv = Dotenv.load();

        Metriport metriport = Metriport.builder()
            .apiKey(dotenv.get("API_KEY"))
            .url(dotenv.get("BASE_URL"))
            .build();

        var response = metriport.medical().patient().list();
        System.out.println("Received response!" + response);
    }
    public static void getSpecificPatient(String[] args) {
        Dotenv dotenv = Dotenv.load();

        Metriport metriport = Metriport.builder()
            .apiKey(dotenv.get("API_KEY"))
            .url(dotenv.get("BASE_URL"))
            .build();

        var response = metriport.medical().patient().get();
        System.out.println("Received response!" + response);
    }

}
