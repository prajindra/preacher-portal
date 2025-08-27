# Firebase Security Rules Check

## Current Issues Identified:
1. Upload errors when trying to upload images in the gallery
2. Images exist in Firebase Storage but are not displaying under preaching activities

## Potential Causes:

### 1. Firebase Storage Security Rules
The Storage security rules might be too restrictive. Check your Firebase Console > Storage > Rules.

**Updated Storage Rules (based on your current rules):**
```javascript
rules_version = '2';

// Craft rules based on data in your Firestore database
// allow write: if firestore.get(
//    /databases/(default)/documents/users/$(request.auth.uid)).data.isAdmin == true;
service firebase.storage {
  match /b/{bucket}/o {
    // Rules for activity report images
    match /activity-reports/{userId}/{reportId}/{imageId} {
      // Allow read if user is authenticated
      allow read: if request.auth != null;
      
      // Allow write if user owns the report or is admin/super_admin
      allow write: if request.auth != null && (
        request.auth.uid == userId ||
        firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role in ['admin', 'super_admin']
      );
      
      // Allow delete if user owns the report or is admin/super_admin
      allow delete: if request.auth != null && (
        request.auth.uid == userId ||
        firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role in ['admin', 'super_admin']
      );
    }
    
    // Rules for profile images
    match /profile-images/{userId}/{imageId} {
      // Allow read if authenticated
      allow read: if request.auth != null;
      
      // Allow write/delete only for own profile images
      allow write, delete: if request.auth != null && request.auth.uid == userId;
    }
    
    // NEW: Rules for gallery images (Mission Images and Preaching Activities)
    match /gallery/{allPaths=**} {
      // Allow public read access for gallery images (so they can be displayed on homepage)
      allow read: if true;
      
      // Allow authenticated users to upload gallery images
      allow write: if request.auth != null;
      
      // Allow delete if user is authenticated (you can make this more restrictive if needed)
      allow delete: if request.auth != null;
    }
    
    // Deny all other access
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

### 2. Firestore Security Rules
The Firestore rules might be preventing read/write access to the galleryImages collection.

**Recommended Firestore Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow public read access to gallery images metadata
    match /galleryImages/{document} {
      allow read: if true; // Public read access for displaying images
      allow write: if request.auth != null; // Only authenticated users can upload
    }
    
    // Other collections require authentication
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 3. Common Upload Error Causes:
- **File size too large**: Check if images are over 5MB limit
- **Invalid file type**: Ensure only image files are being uploaded
- **Authentication issues**: User must be logged in to upload
- **Network connectivity**: Check internet connection
- **Firebase quota limits**: Check if you've exceeded free tier limits

### 4. Common Display Issues:
- **Incorrect category filtering**: Check if images are saved with correct category ('activities' vs 'mission')
- **Firestore query issues**: Verify the fetchGalleryImages function is querying correctly
- **Image URL access**: Check if image URLs are accessible (CORS issues)
- **Real-time listener issues**: Verify onSnapshot listeners are working

## Debug Steps:

1. **Use the debug tool**: Open `debug-gallery.html` in your browser
2. **Test Firebase connection**: Click "Test Firebase Connection"
3. **Check authentication**: Use the test login feature
4. **Debug image data**: Use the debug buttons to see what's in your database
5. **Test upload**: Try uploading a small test image

## Firebase Console Checks:

1. **Storage Console**: 
   - Go to Firebase Console > Storage
   - Check if images are actually being uploaded to `/gallery/` folder
   - Verify file permissions and access

2. **Firestore Console**:
   - Go to Firebase Console > Firestore Database
   - Check the `galleryImages` collection
   - Verify document structure and data

3. **Authentication Console**:
   - Go to Firebase Console > Authentication
   - Ensure users can sign in properly
   - Check if test accounts exist

## Quick Fixes:

### Fix 1: Update Storage Rules (if too restrictive)
```javascript
// Temporary permissive rules for testing
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true; // WARNING: This allows anyone to read/write
    }
  }
}
```

### Fix 2: Update Firestore Rules (if too restrictive)
```javascript
// Temporary permissive rules for testing
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // WARNING: This allows anyone to read/write
    }
  }
}
```

**IMPORTANT**: The above permissive rules are for testing only. Revert to secure rules once issues are resolved.

## Next Steps:
1. Run the debug tool to identify specific issues
2. Check Firebase Console for actual data
3. Update security rules if needed
4. Test upload and display functionality
5. Monitor browser console for detailed error messages
