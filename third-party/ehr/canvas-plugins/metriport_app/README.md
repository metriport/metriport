![Canvas Metriport Integration](https://images.prismic.io/canvas-website/Z8ceyBsAHJWomGnV_metriport_logo_200px.png?auto=format,compress)

# Metriport Integration

### Canvas + Metriport

Providers can have the information they need to stay up-to-date with their patients throughout the full care journey.

- Get instant access to comprehensive patient clinical history summaries from a nationwide network of over 120k provider sites and 260M patients
- Receive a standardized, de-duplicated, and consolidated medical record at the point-of-care

### Manual Workflow

1. Navigate to a patient in Canvas, click the Apps menu from the User Action Panel, and click the Metriport App icon
2. The Metriport App will open in the right chart pane and load the patient data
3. If the patient does not exist in Metriport, the Metriport App will create a patient and fetch their medical data

### Appointment Workflow

1. Schedule an Appointment for a patient in Canvas
2. The Metriport Appointments Created Protocol will send a webhook to Metriport that will create a patient in the background and fetch their medical data for future use in the Metriport App

### Installation

Requirements:

- Authorization for Partner Access to Production Instance
  - Please reach out to [Canvas customer success](mailto:customersuccess@canvasmedical.com) or your Canvas representative to initiate this process
- Metriport Modal Token and Webhook Token
  - Please reach out to [Metriport support](mailto:support@metriport.com) to get a Modal Token and Webhook Token if not already provided

Steps:

1. Install the plugin: `canvas install metriport_app`
2. Set `METRIPORT_MODAL_TOKEN` in the plugin settings to be the token from Requirements
3. Set `METRIPORT_WEBHOOK_TOKEN` in the plugin settings to be the token from Requirements

### About Metriport

Metriport is the world’s first open-source solution for healthcare data exchange that helps providers instantly access, manage, and share comprehensive clinical history data for their patients from outside sources.

Metriport delivers complete patient medical record summaries at the point-of-care, to inform treatment decisions and improve patient outcomes. By standardizing, de-duplicating, consolidating, and hydrating the data with medical code cross-walking, healthcare providers get a rich understanding of their patients' medical histories through Metriport.

See our [documentation](https://docs.metriport.com/ehr-apps/canvas) for more information.
