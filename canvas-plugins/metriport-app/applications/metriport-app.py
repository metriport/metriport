from canvas_sdk.effects import Effect
from canvas_sdk.effects.launch_modal import LaunchModalEffect
from canvas_sdk.handlers.application import Application


class MetriportApp(Application):
    """An embeddable application that can load the Metriport patient data into the canvas patient modal."""

    def on_open(self) -> Effect:
        """Handle the on_open event."""
        # To be used once Ouath flow is implemented
        #oauthClientKey = self.secrets['WEBHOOK_ID']
        #canvasDomain = self.secrets['CANVAS_DOMAIN']
        metriportToken = self.secrets['METRIPORT_TOKEN']
        if (metriportToken is None):
          raise Exception("Metriport token not set")
        if (metriportToken == ""):
          raise Exception("Metriport token is empty")
        # Implement this method to handle the application on_open event.
        return LaunchModalEffect(url=f"https://ehr.metriport.com/canvas/app#patient={self.context['patient']['id']}&access_token={metriportToken}", target=LaunchModalEffect.TargetType.DEFAULT_MODAL).apply()
