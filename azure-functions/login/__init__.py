import logging
import os
import azure.functions as func
from urllib.parse import urlencode

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Login function processed a request.')

    client_id = os.environ.get('DISCORD_CLIENT_ID')
    redirect_uri = os.environ.get('DISCORD_REDIRECT_URI') # URL of your /api/callback Azure Function

    # --- Detailed Logging Added ---
    logging.info(f"Read DISCORD_CLIENT_ID: '{client_id}' (Type: {type(client_id)})")
    logging.info(f"Read DISCORD_REDIRECT_URI: '{redirect_uri}' (Type: {type(redirect_uri)})")
    # --- End Detailed Logging ---

    if not client_id or not redirect_uri:
        logging.error(f"Configuration check failed: client_id is {'set' if client_id else 'NOT set'}, redirect_uri is {'set' if redirect_uri else 'NOT set'}.")
        return func.HttpResponse("Server configuration error.", status_code=500)

    # Get the state (original frontend URL) from query params, default to '/'
    state = req.params.get('state', '/')
    logging.info(f"Received state: {state}")

    # Define required scopes
    scopes = ['identify', 'guilds', 'guilds.members.read']

    # Construct the authorization URL parameters
    params = {
        'client_id': client_id,
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'scope': ' '.join(scopes),
        'state': state,
        'prompt': 'consent' # Force user consent screen
    }

    # Discord authorization endpoint
    authorization_url = f"https://discord.com/api/oauth2/authorize?{urlencode(params)}"

    logging.info(f"Redirecting user to Discord auth URL: {authorization_url}")

    # Redirect the user's browser to Discord
    return func.HttpResponse(
        status_code=302, # Found (Redirect)
        headers={'Location': authorization_url}
        # No body needed for redirect
    )
