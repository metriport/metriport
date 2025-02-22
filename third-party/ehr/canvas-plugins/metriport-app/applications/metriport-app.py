from canvas_sdk.effects import Effect
from canvas_sdk.effects.launch_modal import LaunchModalEffect
from canvas_sdk.handlers.application import Application


class MetriportApp(Application):
    """An embeddable application that can load the Metriport patient data into the canvas patient modal."""

    def on_open(self) -> Effect:
        """Handle the on_open event."""
        # To be used once Ouath flow is implemented
        #oauth_client_id = self.secrets['OUATH_CLIENT_ID']
        #canvas_domain = self.secrets['CANVAS_DOMAIN']
        metriport_token = self.secrets['METRIPORT_TOKEN']
        if (metriport_token is None):
          raise Exception("Metriport token not set")
        if (metriport_token == ""):
          raise Exception("Metriport token is empty")
        return LaunchModalEffect(url=f"https://ehr.metriport.com/canvas/app#patient={self.context['patient']['id']}&access_token={metriport_token}", target=LaunchModalEffect.TargetType.RIGHT_CHART_PANE_LARGE).apply()
