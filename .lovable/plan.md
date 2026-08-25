Update Google Calendar App User Connector credentials

Goal: Swap the currently linked Google Calendar OAuth client credentials for the project after the user rotated them in Google Cloud Console.

Plan
1. Open the Google Calendar App User Connector setup card in the chat using `connector_app_user--connect_client` for `google_calendar`.
2. The user selects or creates the new client and pastes the updated Client ID and Client secret into the Lovable UI.
3. Confirm the Google Cloud OAuth web client has exactly `https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback` as an authorized redirect URI and the required scopes on the consent screen:
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.readonly`
4. After the new client is linked, verify the project secrets are updated (`GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY` and `APP_USER_CONNECTION_KEY_SECRET`).
5. Have the provider open the owner dashboard Calendar tab and click Connect Google Calendar to test the new credentials end-to-end.

Scope: Connector configuration only; no code changes.
