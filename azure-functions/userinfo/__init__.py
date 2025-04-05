import json # Import the standard json library
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
    required_role_id = os.environ.get('REQUIRED_ROLE_ID') # Get required role ID
    if not required_guild_id or not required_role_id: # Check both
        logging.error('Missing REQUIRED_GUILD_ID or REQUIRED_ROLE_ID environment variable.')
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
        logging.info(f"Calling Discord API: {USER_INFO_URL}")
        user_response = requests.get(USER_INFO_URL, headers=auth_headers)
        logging.info(f"Discord user info response status: {user_response.status_code}")

        # Check specifically for 401 Unauthorized first
        if user_response.status_code == 401:
             error_body = f"Unauthorized: Discord API returned 401. Response: {user_response.text}"
             logging.warning(error_body)
             return func.HttpResponse(error_body, status_code=401)
        # Check for other client/server errors from Discord
        elif not user_response.ok:
             error_body = f"Discord API error fetching user info (Status: {user_response.status_code}). Response: {user_response.text}"
             logging.error(error_body)
             # Forward a relevant status code if possible, otherwise 502
             error_status = 502 if user_response.status_code >= 500 else user_response.status_code
             return func.HttpResponse(error_body, status_code=error_status)

        # If response is OK (2xx)
        user_data = user_response.json()
        logging.info(f"Fetched basic info for user: {user_data.get('username')} ({user_data.get('id')})")

        # 3. Get guild-specific member info (including roles)
        logging.info(f"Fetching member info for guild {required_guild_id}")
        member_url = get_guild_member_url(required_guild_id)
        logging.info(f"Calling Discord API: {member_url}")
        member_response = requests.get(member_url, headers=auth_headers)
        logging.info(f"Discord member info response status: {member_response.status_code}")

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
            # Don't fail if member info isn't found (user might have left guild, or other issues)
            # Log different levels based on status code
            if member_response.status_code == 404: # Not Found - User likely not in guild
                 logging.info(f"User not found in required guild {required_guild_id} (Status: 404). Proceeding without roles.")
            elif member_response.status_code == 403: # Forbidden - Bot might lack permissions
                 # Log warning but don't fail the request, just return without roles
                 logging.warning(f"Forbidden from fetching member info for guild {required_guild_id} (Status: 403): {member_response.text}. Check bot permissions.")
            else: # Other errors
                 # Log warning but don't fail the request, just return without roles
                 logging.warning(f"Failed to fetch member info (Status: {member_response.status_code}): {member_response.text}")

        # 4. Verify Required Role (after attempting to fetch roles)
        if required_role_id not in roles:
             logging.warning(f"User {user_data.get('id')} lacks required role {required_role_id}. Roles found: {roles}")
             # Return 403 Forbidden if the required role is missing
             return func.HttpResponse(
                 body=json.dumps({"error": "forbidden", "message": "User does not have the required role."}),
                 status_code=403,
                 mimetype="application/json"
             )
        logging.info(f"User has required role {required_role_id}.")

        # 5. Construct and return the user object for the frontend
        user_info = {
            'id': user_data.get('id'),
            'username': user_data.get('username'),
            'avatar': user_data.get('avatar'),
            # Add other fields if needed: discriminator, global_name, etc.
            'roles': roles # Include the fetched roles
        }

        return func.HttpResponse(
            body=json.dumps(user_info), # Use json.dumps for proper JSON serialization
            status_code=200,
            mimetype="application/json"
        )

    except requests.exceptions.RequestException as e:
        # Handle potential network errors or non-401 HTTP errors
        logging.error(f"Error fetching data from Discord: {e}")
        # Check if it was the user request that failed after a 401 check
        # This block might be less likely to be hit now with explicit checks above, but keep as fallback
        logging.error(f"RequestException during Discord API call: {e}")
        # Try to get status code from response if available
        status_code = e.response.status_code if e.response else 502 # Default to 502 Bad Gateway
        error_body = f"RequestException during Discord API call: {e}. Status: {status_code}. Response: {e.response.text if e.response else 'N/A'}"
        logging.error(error_body)
        # Return the detailed error in the response
        return func.HttpResponse(error_body, status_code=status_code if status_code != 401 else 401) # Ensure 401 is preserved

    except Exception as e:
        # Log the full traceback for unexpected errors
        error_body = f"Unexpected error in userinfo function: {type(e).__name__} - {e}"
        logging.exception("Unexpected error details:") # Log traceback if possible
        return func.HttpResponse(error_body, status_code=500)
