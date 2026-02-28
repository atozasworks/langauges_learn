# PWA Setup Guide for GTongue Learn

This application has been converted to a Progressive Web App (PWA), allowing users to install it on their devices and use it offline.

## Features Added

1. **PWA Manifest** (`manifest.json`) - Defines app metadata, icons, and display mode
2. **Service Worker** (`sw.js`) - Handles offline functionality and caching
3. **Install Popup** - Custom popup that prompts users to install the app
4. **Install Handler** (`js/pwa-install.js`) - Manages the installation process

## Setup Instructions

### 1. Generate Icons

Before deploying, you need to generate the PWA icons:

1. Open `generate-icons.html` in your browser
2. Icons will be auto-generated on page load
3. Click "Download All Icons" to download all required sizes
4. Save all icons in the `icons/` directory with these exact filenames:
   - `icon-72x72.png`
   - `icon-96x96.png`
   - `icon-128x128.png`
   - `icon-144x144.png`
   - `icon-152x152.png`
   - `icon-192x192.png`
   - `icon-384x384.png`
   - `icon-512x512.png`

### 2. Deploy Requirements

For PWA to work properly, the app must be served over HTTPS (or localhost for development):

- **Development**: Use `http-server` or similar on localhost
- **Production**: Must be served over HTTPS

### 3. Testing

1. Open the app in a supported browser (Chrome, Edge, Safari, Firefox)
2. The install popup will appear automatically when the app is installable
3. Click "Install App" to install
4. The app will be added to your home screen/app launcher

## How It Works

### Install Popup

- Automatically appears when the browser detects the app is installable
- Can be dismissed (won't show again for 7 days)
- Shows platform-specific installation instructions if needed

### Service Worker

- Caches app resources for offline use
- Automatically updates when new versions are available
- Handles network requests with cache-first strategy

### Installation Flow

1. User visits the app
2. Browser fires `beforeinstallprompt` event
3. Custom popup appears
4. User clicks "Install App"
5. Browser's native install prompt appears
6. User confirms installation
7. App is installed and can be launched from home screen

## Browser Support

- ✅ Chrome/Edge (Android, Desktop)
- ✅ Safari (iOS 11.3+, macOS)
- ✅ Firefox (Android, Desktop)
- ✅ Samsung Internet

## Troubleshooting

### Icons not showing
- Ensure all icon files exist in the `icons/` directory
- Check that filenames match exactly (case-sensitive)

### Install popup not appearing
- App must be served over HTTPS (or localhost)
- Check browser console for errors
- Ensure service worker is registered successfully

### Service worker not working
- Check browser console for registration errors
- Verify `sw.js` file is accessible
- Clear browser cache and reload

## Customization

### Change App Name
Edit `manifest.json`:
```json
{
  "name": "Your App Name",
  "short_name": "Short Name"
}
```

### Change Theme Color
Edit `manifest.json` and `index.html`:
- `manifest.json`: `"theme_color": "#your-color"`
- `index.html`: `<meta name="theme-color" content="#your-color" />`

### Modify Install Popup
Edit the popup HTML in `index.html` (id: `pwa-install-popup`) and styling in `styles/style.css`

## Notes

- The app will work offline after first visit (resources are cached)
- Service worker updates automatically when new version is deployed
- Install popup respects user dismissal (7-day cooldown)
- App detects if already installed and won't show popup

