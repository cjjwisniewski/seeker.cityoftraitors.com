import logging
import os
import requests
import azure.functions as func
import base64

# Discord API endpoint for token revocation
REVOKE_URL = 'https://discord.com/api/v10/oauth2/token/revoke'

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Logout function processed a request.')

    client_id = os.environ.get('DISCORD_CLIENT_ID')
    client_secret = os.environ.get('DISCORD_CLIENT_SECRET')

    if not client_id or not client_secret:
        logging.error('Missing Discord client credentials for token revocation.')
        # Still return success to the client as they already cleared local state
        return func.HttpResponse(status_code=204) # No Content

    # 1. Extract token from Authorization header
    auth_header = req.headers.get('Authorization')
    access_token = None

    if auth_header and auth_header.startswith('Bearer '):
        access_token = auth_header.split(' ')[1]

    if not access_token:
        logging.warning('No Bearer token provided for logout.')
        # No token to revoke, return success to client
        return func.HttpResponse(status_code=204) # No Content

    # 2. Attempt to revoke the token with Discord
    try:
        logging.info(f"Attempting to revoke token starting with: {access_token[:6]}...")
        revoke_data = {
            'token': access_token,
            'token_type_hint': 'access_token' # Optional but good practice
        }
        # Discord expects client credentials via Basic Auth for revocation
        auth_string = f"{client_id}:{client_secret}"
        basic_auth_header = base64.b64encode(auth_string.encode('utf-8')).decode('utf-8')

        headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': f'Basic {basic_auth_header}'
        }

        response = requests.post(REVOKE_URL, data=revoke_data, headers=headers)

        if response.ok:
            logging.info(f"Successfully revoked token starting with: {access_token[:6]}")
        else:
            # Log the error but don't fail the logout for the client
            logging.error(f"Failed to revoke token (Status: {response.status_code}): {response.text}")

    except requests.exceptions.RequestException as e:
        # Log network or other request errors
        logging.error(f"Error during token revocation request: {e}")
    except Exception as e:
        # Log any other unexpected errors
        logging.exception(f"Unexpected error during token revocation: {e}")

    # 3. Always return success to the client
    # The frontend has already cleared its state.
    return func.HttpResponse(status_code=204) # No Content indicates success with no body
