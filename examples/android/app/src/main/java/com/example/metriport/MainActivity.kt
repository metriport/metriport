package com.example.metriport

import android.os.Bundle
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import kotlinx.android.synthetic.main.activity_main.*


class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView.webViewClient = WebViewClient()

        // For more information of how to create a token view link below
        // https://docs.metriport.com/getting-started/connect-quickstart#4-link-to-the-metriport-connect-widget-in-your-app
        val prodUrl = "https://connect.metriport.com/?token=demo"

        // To use emulator locally make sure to use your IP
        // val localhostUrl = "http://{LOCAL_IP}:3001/?token={YOUR_TOKEN}"

        webView.loadUrl(prodUrl)

        webView.settings.domStorageEnabled = true;

        webView.settings.javaScriptEnabled = true

        webView.settings.setSupportZoom(true)
    }

    override fun onBackPressed() {
        if (webView.canGoBack())
            webView.goBack()
        else
            super.onBackPressed()
    }
}