// Sign-in settings. Both values are public IDs and are safe to ship in the page.
// Leave one empty and its button tells visitors it isn't switched on yet.
export const AUTH_CONFIG = {
  // Google Cloud Console > APIs & Services > Credentials > Create OAuth client ID (Web application).
  // Add your site's address (and http://localhost:5500 for testing) under "Authorised JavaScript origins".
  googleClientId: '',

  // developers.facebook.com > My Apps > Create app > Facebook Login. Copy the App ID and add
  // your site's domain under Settings > Basic > App domains.
  facebookAppId: '',
};
