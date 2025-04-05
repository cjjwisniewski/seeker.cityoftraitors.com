import logging
import os
import requests
import azure.functions as func
from urllib.parse import urlencode, urljoin, urlparse, urlunparse, parse_qs

# Discord API endpoints
TOKEN_URL = 'https://discord.com/api/v10/oauth2/token'
GUILDS_URL = 'https://discord.com/api/v10/users/@me/guilds'
USER_INFO_URL = 'https://discord.com/api/v10/users/@me' # Not strictly needed here, but good reference

def get_guild_member_url(guild_id):
    return f'https://discord.com/api/v10/users/@me/guilds/{guild_id}/member'

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Callback function processed a request.')

    # --- Environment Variables ---
    client_id = os.environ.get('DISCORD_CLIENT_ID')
    client_secret = os.environ.get('DISCORD_CLIENT_SECRET')
    redirect_uri = os.environ.get('DISCORD_REDIRECT_URI') # URL of this Azure Function
    required_guild_id = os.environ.get('REQUIRED_GUILD_ID')
    required_role_id = os.environ.get('REQUIRED_ROLE_ID')
    frontend_url = os.environ.get('FRONTEND_URL') # Base URL of your SvelteKit app
    user_table_func_url = os.environ.get('PUBLIC_USER_TABLE_FUNCTION_URL') # Optional

    # --- Helper Functions ---
    def redirect_to_frontend(path, params=None):
        """Redirects to the frontend URL with optional query parameters."""
        target_url_parts = list(urlparse(urljoin(frontend_url, path))) # Use urljoin for path
        query = dict(parse_qs(target_url_parts[4])) # Existing query params
        if params:
            query.update(params)
        target_url_parts[4] = urlencode(query) # Update query string
        target_url = urlunparse(target_url_parts)

        logging.info(f"Redirecting to frontend: {target_url}")
        return func.HttpResponse(status_code=302, headers={'Location': target_url})

    def redirect_to_frontend_with_token(token, state):
        """Redirects to the frontend URL with token and state in the hash fragment."""
        # Use state as the path, default to '/'
        path = state if state and state.startswith('/') else '/'
        target_url_parts = list(urlparse(urljoin(frontend_url, path)))
        target_url_parts[5] = f"token={token}&state={state or '/'}" # Set fragment
        target_url = urlunparse(target_url_parts)

        logging.info(f"Redirecting to frontend with token: {target_url}")
        return func.HttpResponse(status_code=302, headers={'Location': target_url})

    # --- Input Validation ---
    if not all([client_id, client_secret, redirect_uri, required_guild_id, required_role_id, frontend_url]):
        logging.error('Missing required environment variables.')
        return redirect_to_frontend('/login', {'error': 'config_error', 'message': 'Server configuration error.'})

    code = req.params.get('code')
    state = req.params.get('state') # The original frontend path

    logging.info(f"Callback received: code={'present' if code else 'missing'}, state={state}")

    if not code:
        return redirect_to_frontend('/login', {'error': 'no_code', 'message': 'Authorization code missing.'})

    # --- OAuth Flow ---
    try:
        # 1. Exchange code for token
        logging.info('Requesting token from Discord...')
        token_data = {
            'client_id': client_id,
            'client_secret': client_secret,
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': redirect_uri,
            'scope': 'identify guilds guilds.members.read' # Ensure scopes match login request
        }
        headers = {'Content-Type': 'application/x-www-form-urlencoded'}
        response = requests.post(TOKEN_URL, data=token_data, headers=headers)
        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        token_response = response.json()

        access_token = token_response.get('access_token')
        if not access_token:
            logging.error(f"Invalid token response: {token_response}")
            raise ValueError('Failed to obtain access token from Discord.')
        logging.info('Access token obtained successfully.')

        auth_headers = {'Authorization': f'Bearer {access_token}'}

        # 2. Verify Guild Membership
        logging.info(f"Checking membership for guild: {required_guild_id}")
        guilds_response = requests.get(GUILDS_URL, headers=auth_headers)
        guilds_response.raise_for_status()
        guilds = guilds_response.json()

        if not isinstance(guilds, list):
             logging.error(f"Unexpected guilds response format: {guilds}")
             raise ValueError("Invalid guild data received.")

        is_in_guild = any(guild['id'] == required_guild_id for guild in guilds)
        if not is_in_guild:
            logging.warning(f"User not in required guild {required_guild_id}.")
            return redirect_to_frontend('/login', {'error': 'server_required', 'message': 'You must be a member of the required Discord server.'})
        logging.info('User is in the required guild.')

        # REMOVED: Section 3 - Verify Role Membership (Handled by userinfo function later)

        # Renumbered: 3. (Optional) Initialize User Table
        if user_table_func_url:
            try:
                logging.info(f"Calling user table function: {user_table_func_url}")
                table_response = requests.post( # Or requests.get
                    user_table_func_url,
                    headers=auth_headers # Pass Discord token
                    # json={'userId': user_id} # Optional body if needed
                )
                if not table_response.ok:
                    logging.warning(f"User table function call failed (Status: {table_response.status_code}): {table_response.text}")
                    # Decide if this is critical
                else:
                    logging.info('User table function call successful.')
            except requests.exceptions.RequestException as table_error:
                logging.error(f"Error calling user table function: {table_error}")
                # Decide if this is critical

        # Renumbered: 4. Redirect back to frontend with token and state in hash
        logging.info('Guild check passed. Redirecting to frontend with token.')
        return redirect_to_frontend_with_token(access_token, state)

    except requests.exceptions.RequestException as e:
        logging.error(f"HTTP request failed: {e}")
        # Try to get more details from response if available
        error_details = e.response.text if e.response else "No response details"
        logging.error(f"Response details: {error_details}")
        message = f"Communication error with Discord: {e}"
        return redirect_to_frontend('/login', {'error': 'discord_api_error', 'message': message})
    except Exception as e:
        logging.exception(f"Error during OAuth callback processing: {e}") # Log full traceback
        message = str(e) or 'An unexpected error occurred during authentication.'
        return redirect_to_frontend('/login', {'error': 'callback_failed', 'message': message})
