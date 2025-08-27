# FIRESTORE RULES FIX - URGENT

## 🚨 **ISSUE CONFIRMED**: Firestore Rules Blocking Gallery Access

The debug tool shows `permission-denied` errors when trying to access the `galleryImages` collection. This means your Firestore security rules don't allow access to this collection.

## ✅ **SOLUTION**: Update Firestore Rules

**Go to Firebase Console > Firestore Database > Rules** and add the gallery rules:

### **Current Firestore Rules** (add this to your existing rules):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ADD THIS: Rules for gallery images collection
    match /galleryImages/{document} {
      // Allow public read access so images can display on homepage
      allow read: if true;
      
      // Allow authenticated users to upload images
      allow write: if request.auth != null;
      
      // Allow authenticated users to delete images
      allow delete: if request.auth != null;
    }
    
    // Your existing rules for other collections...
    // (keep all your existing rules here)
    
  }
}
```

## 🔧 **COMPLETE RULES NEEDED**:

### **1. FIRESTORE RULES** (Firebase Console > Firestore Database > Rules):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Gallery images collection - NEW
    match /galleryImages/{document} {
      allow read: if true; // Public read for homepage display
      allow write: if request.auth != null; // Auth required for upload
      allow delete: if request.auth != null; // Auth required for delete
    }
    
    // Your existing collections (keep these as they are)
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### **2. STORAGE RULES** (Firebase Console > Storage > Rules):
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Rules for activity report images (EXISTING - keep as is)
    match /activity-reports/{userId}/{reportId}/{imageId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && (
        request.auth.uid == userId ||
        firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role in ['admin', 'super_admin']
      );
      allow delete: if request.auth != null && (
        request.auth.uid == userId ||
        firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role in ['admin', 'super_admin']
      );
    }
    
    // Rules for profile images (EXISTING - keep as is)
    match /profile-images/{userId}/{imageId} {
      allow read: if request.auth != null;
      allow write, delete: if request.auth != null && request.auth.uid == userId;
    }
    
    // NEW: Rules for gallery images
    match /gallery/{allPaths=**} {
      allow read: if true; // Public read access for homepage display
      allow write: if request.auth != null; // Authenticated users can upload
      allow delete: if request.auth != null; // Authenticated users can delete
    }
    
    // Deny all other access (EXISTING - keep as is)
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

## 🧪 **TESTING STEPS**:

1. **Update Firestore Rules** (above)
2. **Update Storage Rules** (above)
3. **Wait 1-2 minutes** for rules to propagate
4. **Refresh the debug tool page**
5. **Test in order**:
   - Click "Test Firebase Connection" (should be green ✅)
   - Click "Test Firestore Rules" (should be green ✅)
   - Click "Test Storage Rules" (should be green ✅)
   - Click "Test Login" to create test account
   - Try uploading an image

## 🎯 **Expected Results After Rule Updates**:

- ✅ All debug tests should pass (green checkmarks)
- ✅ Image upload should work without errors
- ✅ Images should display in gallery and homepage
- ✅ Real-time updates should work

## ⚠️ **IMPORTANT NOTES**:

1. **Update BOTH Firestore AND Storage rules**
2. **Wait 1-2 minutes** after updating rules before testing
3. **Keep your existing rules** for other collections/paths
4. **The gallery rules are additive** - they don't replace your existing rules

The debug tool has confirmed the exact issue - now we just need to update the security rules to allow gallery access!
