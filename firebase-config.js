// Firebase configuration file
// Replace the placeholders with your Firebase project details

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDDwhHBhlkIXOCCbvL-S69xZ54JB8DIPz8",
  authDomain: "preachers-portal.firebaseapp.com",
  projectId: "preachers-portal",
  storageBucket: "preachers-portal.firebasestorage.app",
  messagingSenderId: "694684127738",
  appId: "1:694684127738:web:7625f85a90467f7486d443"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
