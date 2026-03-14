# Google Login Setup

To enable "Log in with Google" you must configure both **Google Cloud Console** and **Supabase Dashboard**.

## 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and select (or create) a project.
2. **APIs & Services → Credentials** → **Create Credentials** → **OAuth client ID**.
3. If prompted, configure the OAuth consent screen (external user type is fine for testing).
4. Application type: **Web application**.
5. Add **Authorized redirect URIs**:
   - Copy the **Callback URL** from Supabase (step 2 below) and paste it here. It looks like:
     `https://<project-ref>.supabase.co/auth/v1/callback`
6. Create and copy the **Client ID** and **Client Secret**.

## 2. Supabase Dashboard

1. Open your project at [Supabase Dashboard](https://supabase.com/dashboard) → **Authentication** → **Providers**.
2. Enable **Google** and paste the **Client ID** and **Client Secret** from Google Cloud.
3. **Authentication** → **URL Configuration**:
   - Add your app URL(s) to **Redirect URLs**, e.g.:
     - `http://localhost:5173/` (Vite dev)
     - Your production URL if deployed
4. Save.

**Verify:** Google appears as enabled in Authentication → Providers, and your app origin(s) are listed in Redirect URLs.
