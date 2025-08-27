# Firebase Storage Rules Fix for Resources Upload

## Problem
Users are getting "Firebase Storage: User does not have permission to access 'resources/...' (storage/unauthorized)" error when trying to upload resources.

## Solution
The Firebase Storage security rules need to be updated to allow authenticated users to upload files to the `resources/` path and `gallery/` path.

## Required Firebase Storage Rules

Go to your Firebase Console → Storage → Rules and replace the current rules with:

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    // Allow authenticated users to upload and read gallery images
    match /gallery/{allPaths=**} {
      allow read: if true; // Anyone can read gallery images
      allow write: if request.auth != null; // Only authenticated users can upload
    }
    
    // Allow authenticated users to upload and read resources
    match /resources/{allPaths=**} {
      allow read: if true; // Anyone can read/download resources
      allow write: if request.auth != null && request.auth.uid != null; // Only authenticated users can upload
    }
    
    // Default rule for other paths (optional, for security)
    match /{allPaths=**} {
      allow read, write: if false; // Deny access to other paths
    }
  }
}
```

## Alternative Rules (More Restrictive - Role-Based)

If you want to restrict uploads to only admin/super_admin users at the Storage level (recommended for production):

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    // Function to check if user has admin role
    function isAdmin() {
      return request.auth != null && 
             request.auth.uid != null &&
             (get(/databases/(default)/documents/users/$(request.auth.uid)).data.role in ['admin', 'super_admin']);
    }
    
    // Gallery images - any authenticated user can upload
    match /gallery/{allPaths=**} {
      allow read: if true; // Anyone can read gallery images
      allow write: if request.auth != null; // Authenticated users can upload
    }
    
    // Resources - only admins can upload, anyone can read
    match /resources/{allPaths=**} {
      allow read: if true; // Anyone can read/download resources
      allow write: if isAdmin(); // Only admin/super_admin can upload
    }
    
    // Default rule for other paths
    match /{allPaths=**} {
      allow read, write: if false; // Deny access to other paths
    }
  }
}
```

## Steps to Apply the Fix

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `preachers-portal`
3. Navigate to **Storage** in the left sidebar
4. Click on the **Rules** tab
5. Replace the existing rules with one of the rule sets above
6. Click **Publish** to save the changes

## Recommendation

Start with the **first rule set** (simpler) to get the upload working immediately. The application already handles role-based access control in the frontend, so Storage-level role checking is optional but adds an extra layer of security.

## Testing

After applying the rules:
1. Try uploading a resource again
2. The upload should work without permission errors
3. Verify that non-authenticated users can still download resources
4. Verify that only admin/super_admin users see the upload interface

## Current Error Details

- **Error**: `Firebase Storage: User does not have permission to access 'resources/presentations/1756263595979_Melawati School_ Behaviourial Science.pptx' (storage/unauthorized)`
- **Cause**: Current Storage rules don't allow authenticated users to write to `resources/` path
- **Fix**: Apply the Storage rules above to grant proper permissions
