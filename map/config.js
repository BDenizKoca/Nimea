// Netlify configuration for live CMS
// Build hook URL for automatic rebuilds when DM makes changes

// SECURITY NOTE: In production (Netlify), set NETLIFY_BUILD_HOOK as an environment variable
// Locally, you can set it in .env file (not committed to Git)

// Default fallback (replace with your actual hook if not using env vars)
window.NETLIFY_BUILD_HOOK = 'https://api.netlify.com/build_hooks/68df40733d69da60501dba60';

// Override with environment variable if available (Netlify will inject this)
if (window.NETLIFY_ENV && window.NETLIFY_ENV.BUILD_HOOK) {
    window.NETLIFY_BUILD_HOOK = window.NETLIFY_ENV.BUILD_HOOK;
}