# ISKCON Malaysia Preaching Network Website

## Issues Fixed

### 1. About Our Mission Image
✅ **FIXED**: Replaced placeholder image with proper ISKCON-related image from Unsplash.

### 2. Gallery Page Issues
The gallery page shows "No images uploaded yet" and tab switching doesn't work due to CORS restrictions when serving from `file://` protocol.

### 3. Our Preaching Activities Section
The homepage "Our Preaching Activities" section shows "No Images Yet" due to the same CORS issues.

## Root Cause: CORS Restrictions

The main issue is that Firebase modules cannot load when serving the website directly from the file system (`file://` protocol). This prevents:
- Image uploads and downloads from Firebase Storage
- Gallery functionality
- Tab switching on gallery page
- Real-time image loading

## Solution: Use HTTP Server

To resolve these issues and test the website properly, you need to serve it through an HTTP server:

### Option 1: Use the Provided Batch File (Windows)
1. Double-click `start-server.bat`
2. The server will start at `http://localhost:8000`
3. Open your browser and go to `http://localhost:8000`

### Option 2: Manual Command (Any OS)
1. Open terminal/command prompt in the website folder
2. Run: `python -m http.server 8000`
3. Open browser and go to `http://localhost:8000`

### Option 3: Alternative HTTP Servers
- **Node.js**: `npx http-server -p 8000`
- **PHP**: `php -S localhost:8000`
- **Live Server** (VS Code extension)

## Testing the Fixes

Once the HTTP server is running:

1. **Homepage**: 
   - ✅ About Our Mission image should display properly
   - 🔧 Our Preaching Activities section will load images from Firebase (if any exist)

2. **Gallery Page** (`http://localhost:8000/gallery.html`):
   - 🔧 Tab switching between "Mission Images" and "Preaching Activities" will work
   - 🔧 Image upload functionality will work
   - 🔧 Uploaded images will display properly

3. **Debug Features**:
   - Use the "Debug Gallery Data" button to check Firebase connectivity
   - Console logs will show detailed information about image loading

## Firebase Configuration

The website is configured to connect to Firebase for:
- User authentication
- Image storage and retrieval
- Real-time data synchronization

Make sure your Firebase project is properly configured with:
- Authentication enabled
- Firestore database
- Storage bucket
- Proper security rules

## File Structure

```
Website/
├── index.html              # Main homepage
├── gallery.html           # Gallery page
├── auth.html              # Authentication modal
├── firebase-config.js     # Firebase configuration
├── firebase-data.js       # Firebase data operations
├── debug-gallery.html     # Debug tools
├── start-server.bat       # Windows server startup script
└── README.md             # This file
```

## Troubleshooting

### If images still don't load:
1. Check browser console for errors
2. Verify Firebase configuration
3. Check Firebase security rules
4. Use the debug functions to test connectivity

### If server won't start:
1. Make sure Python is installed
2. Try a different port: `python -m http.server 3000`
3. Check if port 8000 is already in use

## Next Steps

1. Start the HTTP server using one of the methods above
2. Test the gallery functionality
3. Upload some images to verify everything works
4. Check that images appear in both the gallery and homepage sections

The website should now work properly with all Firebase features enabled when served through HTTP instead of the file system.
