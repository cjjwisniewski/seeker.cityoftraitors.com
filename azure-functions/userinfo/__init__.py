import logging
import os
import requests
import azure.functions as func

# Discord API endpoints
USER_INFO_URL = 'https://discord.com/api/v10/users/@me'
def get_guild_member_url(guild_id):
    return f'https://discord.com/api/v10/users/@me/guilds/{guild_id}/member'

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Userinfo function processed a request.')

    required_guild_id = os.environ.get('REQUIRED_GUILD_ID')
    if not required_guild_id:
        logging.error('Missing REQUIRED_GUILD_ID environment variable.')
        return func.HttpResponse("Server configuration error.", status_code=500)

    # 1. Extract token from Authorization header
    auth_header = req.headers.get('Authorization')
    logging.info(f"Received Authorization header: {auth_header}") # Log the raw header
    access_token = None

    if auth_header and auth_header.startswith('Bearer '):
        try:
            access_token = auth_header.split(' ')[1]
            # Log only a few characters for security
            logging.info(f"Successfully extracted token (first 5 chars): {access_token[:5]}...")
        except IndexError:
            logging.warning(f"Authorization header present but malformed (no space after Bearer?): {auth_header}")
            # access_token remains None
    elif auth_header:
        logging.warning(f"Authorization header present but does not start with 'Bearer ': {auth_header}")
        # access_token remains None

    if not access_token:
        # Log entry into this specific block before returning
        logging.warning('Condition `not access_token` is true. Returning 401.')
        return func.HttpResponse("Unauthorized: Missing token.", status_code=401)

    # This log should only appear if a token was successfully extracted
    logging.info('Bearer token extracted successfully, proceeding to fetch user info.')
    auth_headers = {'Authorization': f'Bearer {access_token}'}

    try:
        # 2. Get basic user info from Discord
        user_response = requests.get(USER_INFO_URL, headers=auth_headers)

        # Check specifically for 401 Unauthorized first
        if user_response.status_code == 401:
             logging.warning(f"Discord API returned 401 for user info: {user_response.text}")
             return func.HttpResponse("Unauthorized: Invalid or expired token.", status_code=401)

        user_response.raise_for_status() # Raise for other errors (4xx, 5xx)
        user_data = user_response.json()
        logging.info(f"Fetched basic info for user: {user_data.get('username')} ({user_data.get('id')})")

        # 3. Get guild-specific member info (including roles)
        logging.info(f"Fetching member info for guild {required_guild_id}")
        member_url = get_guild_member_url(required_guild_id)
        member_response = requests.get(member_url, headers=auth_headers)

        roles = [] # Default to empty list
        if member_response.ok:
            member_data = member_response.json()
            if isinstance(member_data.get('roles'), list):
                roles = member_data['roles']
                logging.info(f"Fetched roles for user: {', '.join(roles)}")
            else:
                logging.warning(f"Could not parse roles from member data: {member_data}")
        else:
            # Don't fail if member info isn't found (user might have left guild)
            logging.warning(f"Failed to fetch member info (Status: {member_response.status_code}): {member_response.text}")

        # 4. Construct and return the user object for the frontend
        user_info = {
            'id': user_data.get('id'),
            'username': user_data.get('username'),
            'avatar': user_data.get('avatar'),
            # Add other fields if needed: discriminator, global_name, etc.
            'roles': roles # Include the fetched roles
        }

        return func.HttpResponse(
            body=func.JsonEncoder().encode(user_info), # Use JsonEncoder for proper JSON serialization
            status_code=200,
            mimetype="application/json"
        )

    except requests.exceptions.RequestException as e:
        # Handle potential network errors or non-401 HTTP errors
        logging.error(f"Error fetching data from Discord: {e}")
        # Check if it was the user request that failed after a 401 check
        if e.response and e.response.status_code == 401:
             return func.HttpResponse("Unauthorized: Invalid or expired token.", status_code=401)
        else:
             return func.HttpResponse("Failed to retrieve user information from Discord.", status_code=502) # Bad Gateway
    except Exception as e:
        logging.exception(f"Unexpected error in userinfo function: {e}")
        return func.HttpResponse("An internal server error occurred.", status_code=500)
