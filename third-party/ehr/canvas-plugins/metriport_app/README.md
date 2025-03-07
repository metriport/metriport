# metriport_app

## Description

Get instant access to comprehensive patient clinical history summaries, and more.

### Installation

Requirements:

1. [Canvas CLI](https://docs.canvasmedical.com/sdk/canvas_cli/)
2. Metriport Token
3. Metriport Webhook Token

Please reach out to support@metriport.com to get a Metriport Token and Webhook Token if not already provided.

Steps:

1. Install the plugin: `canvas install metriport_app`
2. Set `METRIPORT_TOKEN` in the plugin settings to be the token from Requirements (2).
3. Set `METRIPORT_WEBHOOK_TOKEN` in the plugin settings to be the token from Requirements (3).

### In Canvas App Usage

1. Navigate to a patient chart in Canvas, click the apps menu, and click the Metriport App icon.
2. The Metriport App will load the patient medical data into the Canvas patient modal.

### Background Webhook Usage

1. Create a new Appointment for a patient in Canvas.
2. The Metriport Appointments Created Protocol will send a webhook to the Metriport API that will create a patient in the background and fetch their medical data for future use in the Canvas patient modal.

If you do not want to use the Appointments Created Protocol, simply leave the Metriport Webhook Token blank in the plugin settings.
