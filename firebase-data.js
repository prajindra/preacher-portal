// Firebase data operations for Preaching Impact and Dashboard
import { db, storage } from './firebase-config.js';
import { 
    collection, 
    getDocs, 
    query, 
    orderBy, 
    limit, 
    where,
    onSnapshot,
    doc,
    getDoc,
    addDoc,
    deleteDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js';

// Cache for data to avoid repeated fetches
let dataCache = {
    activityReports: null,
    preachingCategories: null,
    users: null,
    lastFetch: null
};

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// Check if cache is valid
function isCacheValid() {
    return dataCache.lastFetch && (Date.now() - dataCache.lastFetch) < CACHE_DURATION;
}

// Fetch all activity reports
export async function fetchActivityReports() {
    try {
        if (isCacheValid() && dataCache.activityReports) {
            return dataCache.activityReports;
        }

        const reportsRef = collection(db, 'activityReports');
        const q = query(reportsRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const reports = [];
        querySnapshot.forEach((doc) => {
            reports.push({
                id: doc.id,
                ...doc.data()
            });
        });

        dataCache.activityReports = reports;
        dataCache.lastFetch = Date.now();
        return reports;
    } catch (error) {
        console.error('Error fetching activity reports:', error);
        return [];
    }
}

// Fetch preaching categories
export async function fetchPreachingCategories() {
    try {
        if (isCacheValid() && dataCache.preachingCategories) {
            return dataCache.preachingCategories;
        }

        const categoriesRef = collection(db, 'preachingCategories');
        const querySnapshot = await getDocs(categoriesRef);
        
        const categories = {};
        querySnapshot.forEach((doc) => {
            categories[doc.id] = doc.data();
        });

        dataCache.preachingCategories = categories;
        return categories;
    } catch (error) {
        console.error('Error fetching preaching categories:', error);
        return {};
    }
}

// Fetch users data
export async function fetchUsers() {
    try {
        if (isCacheValid() && dataCache.users) {
            return dataCache.users;
        }

        const usersRef = collection(db, 'users');
        const querySnapshot = await getDocs(usersRef);
        
        const users = {};
        querySnapshot.forEach((doc) => {
            users[doc.id] = doc.data();
        });

        dataCache.users = users;
        return users;
    } catch (error) {
        console.error('Error fetching users:', error);
        return {};
    }
}

// Calculate statistics for the impact section
export async function calculatePreachingImpact() {
    try {
        const reports = await fetchActivityReports();
        const users = await fetchUsers();
        
        let totalReports = reports.length;
        let totalBooksDistributed = 0;
        let totalPrasadamServed = 0;
        let totalNewContacts = 0; // Lives Touched - new contacts
        let templesWithReports = new Set(); // For cities covered

        reports.forEach(report => {
            // Count books distributed
            if (report.booksDistributed) {
                if (typeof report.booksDistributed === 'object') {
                    // Handle different book sizes
                    totalBooksDistributed += (report.booksDistributed.big || 0) + 
                                           (report.booksDistributed.medium || 0) + 
                                           (report.booksDistributed.small || 0);
                } else {
                    totalBooksDistributed += report.booksDistributed;
                }
            }

            // Count NEW contacts (people reached) - Lives Touched
            if (report.contacts && Array.isArray(report.contacts)) {
                // Filter for new contacts only (those who weren't contacted before)
                const newContacts = report.contacts.filter(contact => 
                    contact.isNewContact === true || contact.isNew === true || 
                    (contact.contactType && contact.contactType === 'new')
                );
                totalNewContacts += newContacts.length > 0 ? newContacts.length : report.contacts.length;
            } else if (report.newContacts) {
                // Direct field for new contacts
                totalNewContacts += report.newContacts;
            }

            // Count prasadam served (estimate based on contacts or separate field)
            if (report.prasadamServed) {
                totalPrasadamServed += report.prasadamServed;
            } else if (report.contacts) {
                // Estimate prasadam as 1.5x contacts if not specified
                totalPrasadamServed += Math.floor(report.contacts.length * 1.5);
            }

            // Track temples that have submitted reports (for cities covered)
            if (report.createdBy) {
                const user = users[report.createdBy];
                if (user && user.temple) {
                    templesWithReports.add(user.temple);
                }
            }
        });

        // Active Preachers = Total number of registered users
        const totalRegisteredUsers = Object.keys(users).length;

        // Cities Covered = Number of temples that have submitted reports
        const citiesCovered = templesWithReports.size;

        return {
            totalReports,
            totalBooksDistributed,
            totalPrasadamServed: totalPrasadamServed || totalNewContacts * 2, // Fallback estimate
            livesTouched: totalNewContacts, // Lives Touched - new contacts
            activePreachers: totalRegisteredUsers, // Total registered users
            citiesCovered: citiesCovered // Number of temples with reports
        };
    } catch (error) {
        console.error('Error calculating preaching impact:', error);
        return {
            totalReports: 0,
            totalBooksDistributed: 0,
            totalPrasadamServed: 0,
            livesTouched: 0,
            activePreachers: 0,
            citiesCovered: 0
        };
    }
}

// Get recent reports for dashboard table
export async function getRecentReports(limitCount = 10) {
    try {
        const reports = await fetchActivityReports();
        const categories = await fetchPreachingCategories();
        const users = await fetchUsers();

        // Get the most recent reports
        const recentReports = reports.slice(0, limitCount);

        // Enrich reports with category and user information
        const enrichedReports = recentReports.map(report => {
            const category = categories[report.categoryId] || {};
            const user = users[report.createdBy] || {};

            // Calculate total books
            let totalBooks = 0;
            if (report.booksDistributed) {
                if (typeof report.booksDistributed === 'object') {
                    totalBooks = (report.booksDistributed.big || 0) + 
                               (report.booksDistributed.medium || 0) + 
                               (report.booksDistributed.small || 0);
                } else {
                    totalBooks = report.booksDistributed;
                }
            }

            // Calculate prasadam count
            let prasadamCount = 0;
            if (report.prasadamServed) {
                prasadamCount = report.prasadamServed;
            } else if (report.contacts && Array.isArray(report.contacts)) {
                prasadamCount = Math.floor(report.contacts.length * 1.5);
            }

            // Ensure we get the correct activity name from categoryName field
            let activityName = 'Unknown Activity';
            if (category && category.categoryName) {
                activityName = category.categoryName;
            } else if (report.categoryName) {
                // Fallback: check if categoryName is directly in the report
                activityName = report.categoryName;
            } else if (category && category.name) {
                // Another fallback: check for 'name' field
                activityName = category.name;
            }

            return {
                id: report.id,
                date: report.date || report.createdAt?.toDate?.()?.toISOString().split('T')[0] || 'N/A',
                preacher: user.displayName || user.name || user.email || 'Unknown',
                temple: user.temple || 'N/A',
                activity: activityName,
                books: totalBooks,
                prasadam: prasadamCount,
                contacts: report.contacts ? report.contacts.length : 0,
                createdAt: report.createdAt
            };
        });

        return enrichedReports;
    } catch (error) {
        console.error('Error getting recent reports:', error);
        return [];
    }
}

// Get chart data for zones/regions
export async function getChartData() {
    try {
        const reports = await fetchActivityReports();
        const users = await fetchUsers();

        // Group data by temple/region
        const regionData = {};
        
        reports.forEach(report => {
            const user = users[report.createdBy] || {};
            const temple = user.temple || 'Unknown';
            
            if (!regionData[temple]) {
                regionData[temple] = {
                    books: 0,
                    prasadam: 0,
                    events: 0
                };
            }

            // Count books
            if (report.booksDistributed) {
                if (typeof report.booksDistributed === 'object') {
                    regionData[temple].books += (report.booksDistributed.big || 0) + 
                                              (report.booksDistributed.medium || 0) + 
                                              (report.booksDistributed.small || 0);
                } else {
                    regionData[temple].books += report.booksDistributed;
                }
            }

            // Count prasadam
            if (report.prasadamServed) {
                regionData[temple].prasadam += report.prasadamServed;
            } else if (report.contacts && Array.isArray(report.contacts)) {
                regionData[temple].prasadam += Math.floor(report.contacts.length * 1.5);
            }

            // Count events (each report is an event/activity)
            regionData[temple].events += 1;
        });

        // Convert to arrays for charts
        const regions = Object.keys(regionData).slice(0, 5); // Top 5 regions
        const booksData = regions.map(region => regionData[region].books);
        const prasadamData = regions.map(region => regionData[region].prasadam);
        const eventsData = regions.map(region => regionData[region].events);

        return {
            regions,
            booksData,
            prasadamData,
            eventsData
        };
    } catch (error) {
        console.error('Error getting chart data:', error);
        return {
            regions: ['Kuala Lumpur', 'Penang', 'Johor', 'Ipoh', 'Kuching'],
            booksData: [0, 0, 0, 0, 0],
            prasadamData: [0, 0, 0, 0, 0],
            eventsData: [0, 0, 0, 0, 0]
        };
    }
}

// Get pie chart data for activity categories
export async function getPieChartData() {
    try {
        const reports = await fetchActivityReports();
        const categories = await fetchPreachingCategories();

        // Group by category
        const categoryData = {};
        
        // First, initialize all categories from the database with 0 count
        Object.values(categories).forEach(category => {
            const categoryName = category.categoryName || category.name || 'Unknown Category';
            if (!categoryData[categoryName]) {
                categoryData[categoryName] = 0;
            }
        });
        
        // Then count actual reports for each category
        reports.forEach(report => {
            const category = categories[report.categoryId] || {};
            let categoryName = 'Other';
            
            // Try multiple fields to get the category name
            if (category.categoryName) {
                categoryName = category.categoryName;
            } else if (category.name) {
                categoryName = category.name;
            } else if (report.categoryName) {
                // Fallback: check if categoryName is directly in the report
                categoryName = report.categoryName;
            }
            
            if (!categoryData[categoryName]) {
                categoryData[categoryName] = 0;
            }
            categoryData[categoryName] += 1;
        });

        // Convert to array format for pie chart, filtering out categories with 0 count
        const pieData = Object.entries(categoryData)
            .filter(([name, value]) => value > 0) // Only show categories with actual data
            .map(([name, value]) => ({
                name,
                value
            }))
            .sort((a, b) => b.value - a.value); // Sort by value descending

        // If no data found, return all categories from database with 0 values for display
        if (pieData.length === 0) {
            return Object.values(categories).map(category => ({
                name: category.categoryName || category.name || 'Unknown Category',
                value: 0
            }));
        }

        return pieData;
    } catch (error) {
        console.error('Error getting pie chart data:', error);
        // Return fallback data if there's an error
        return [
            { name: 'Book Distribution', value: 0 },
            { name: 'Harinama Sankirtana', value: 0 },
            { name: 'Food for Life', value: 0 },
            { name: 'Temple Programs', value: 0 },
            { name: 'University Programs', value: 0 }
        ];
    }
}

// Real-time listener for activity reports
export function listenToActivityReports(callback) {
    try {
        const reportsRef = collection(db, 'activityReports');
        const q = query(reportsRef, orderBy('createdAt', 'desc'), limit(50));
        
        return onSnapshot(q, (querySnapshot) => {
            const reports = [];
            querySnapshot.forEach((doc) => {
                reports.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Update cache
            dataCache.activityReports = reports;
            dataCache.lastFetch = Date.now();
            
            callback(reports);
        });
    } catch (error) {
        console.error('Error setting up real-time listener:', error);
        return null;
    }
}

// Preaching Resources Functions

// Upload resource file to Firebase Storage and save metadata to Firestore
export async function uploadResource(file, category, title, description, userId) {
    try {
        console.log('=== RESOURCE UPLOAD PROCESS START ===');
        console.log('Upload parameters:', { 
            fileName: file.name, 
            fileSize: file.size, 
            fileType: file.type, 
            category, 
            title, 
            description,
            userId 
        });

        // Validate inputs
        if (!file) {
            throw new Error('No file provided');
        }
        if (!category) {
            throw new Error('Category is required');
        }
        if (!title) {
            throw new Error('Title is required');
        }
        if (!userId) {
            throw new Error('User ID is required');
        }

        // Validate file size (50MB limit for resources)
        if (file.size > 50 * 1024 * 1024) {
            throw new Error('File size exceeds 50MB limit');
        }

        console.log('✓ All validations passed');

        // Create a unique filename
        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const baseName = file.name.replace(/\.[^/.]+$/, '');
        const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9\s]/g, '_');
        const filename = `${category}/${timestamp}_${sanitizedBaseName}.${fileExtension}`;
        
        console.log('Generated filename:', filename);
        
        // Upload file to Firebase Storage
        const storageRef = ref(storage, `resources/${filename}`);
        console.log('Starting Firebase Storage upload...');
        
        const snapshot = await uploadBytes(storageRef, file);
        console.log('✓ Upload to Storage successful');
        
        // Get download URL
        const downloadURL = await getDownloadURL(storageRef);
        console.log('✓ Download URL obtained');
        
        // Save resource metadata to Firestore
        const resourceData = {
            title: title,
            description: description || '',
            category: category, // 'books', 'presentations', 'videos', 'templates'
            url: downloadURL,
            filename: filename,
            originalName: file.name,
            size: file.size,
            type: file.type,
            fileExtension: fileExtension.toUpperCase(),
            uploadedBy: userId,
            uploadedAt: new Date().toISOString(),
            createdAt: serverTimestamp(),
            downloads: 0,
            isActive: true
        };
        
        console.log('Saving metadata to Firestore:', resourceData);
        const docRef = await addDoc(collection(db, 'preachingResources'), resourceData);
        console.log('✓ Metadata saved successfully with ID:', docRef.id);
        
        console.log('=== RESOURCE UPLOAD PROCESS COMPLETE ===');
        return {
            id: docRef.id,
            ...resourceData,
            createdAt: new Date()
        };
        
    } catch (error) {
        console.error('=== RESOURCE UPLOAD PROCESS FAILED ===');
        console.error('Error uploading resource:', error);
        throw new Error(`Upload failed: ${error.message}`);
    }
}

// Fetch resources by category
export async function fetchResources(category = null) {
    try {
        console.log('=== FETCH RESOURCES START ===');
        console.log('Requested category:', category);
        
        const resourcesRef = collection(db, 'preachingResources');
        let q;
        
        if (category) {
            q = query(resourcesRef, where('category', '==', category), where('isActive', '==', true));
        } else {
            q = query(resourcesRef, where('isActive', '==', true));
        }
        
        const querySnapshot = await getDocs(q);
        console.log('Query snapshot size:', querySnapshot.size);
        
        const resources = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            resources.push({
                id: doc.id,
                ...data,
                uploadedAt: data.uploadedAt || data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                formattedSize: formatFileSize(data.size || 0)
            });
        });
        
        // Sort by upload date (newest first)
        resources.sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(a.uploadedAt || 0);
            const dateB = b.createdAt?.toDate?.() || new Date(b.uploadedAt || 0);
            return dateB - dateA;
        });
        
        console.log(`✓ Processed ${resources.length} resources for category '${category}'`);
        console.log('=== FETCH RESOURCES END ===');
        
        return resources;
    } catch (error) {
        console.error('Error fetching resources:', error);
        return [];
    }
}

// Delete resource from both Storage and Firestore
export async function deleteResource(resourceId, filename) {
    try {
        // Delete from Firestore
        const resourceRef = doc(db, 'preachingResources', resourceId);
        await deleteDoc(resourceRef);
        
        // Delete from Storage
        const storageRef = ref(storage, `resources/${filename}`);
        await deleteObject(storageRef);
        
        console.log('Resource deleted successfully');
        return true;
    } catch (error) {
        console.error('Error deleting resource:', error);
        throw error;
    }
}

// Increment download count for a resource
export async function incrementDownloadCount(resourceId) {
    try {
        const { doc, updateDoc, increment } = await import('https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js');
        
        const resourceRef = doc(db, 'preachingResources', resourceId);
        await updateDoc(resourceRef, {
            downloads: increment(1),
            lastDownloaded: new Date().toISOString()
        });
        
        console.log('Download count incremented for resource:', resourceId);
        return true;
    } catch (error) {
        console.error('Error incrementing download count:', error);
        return false;
    }
}

// Format file size for display
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Real-time listener for resources
export function listenToResources(category, callback) {
    try {
        console.log(`Setting up real-time listener for resources category: ${category}`);
        const resourcesRef = collection(db, 'preachingResources');
        let q;
        
        if (category) {
            q = query(resourcesRef, where('category', '==', category), where('isActive', '==', true));
        } else {
            q = query(resourcesRef, where('isActive', '==', true));
        }
        
        return onSnapshot(q, (querySnapshot) => {
            console.log(`Real-time update: ${querySnapshot.size} resources found for category '${category}'`);
            const resources = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                resources.push({
                    id: doc.id,
                    ...data,
                    uploadedAt: data.uploadedAt || data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                    formattedSize: formatFileSize(data.size || 0)
                });
            });
            
            // Sort by upload date (newest first)
            resources.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(a.uploadedAt || 0);
                const dateB = b.createdAt?.toDate?.() || new Date(b.uploadedAt || 0);
                return dateB - dateA;
            });
            
            console.log(`Calling callback with ${resources.length} sorted resources`);
            callback(resources);
        }, (error) => {
            console.error('Real-time listener error for resources:', error);
            // Fallback to manual fetch
            fetchResources(category).then(resources => {
                callback(resources);
            }).catch(fetchError => {
                console.error('Manual fallback fetch failed:', fetchError);
                callback([]);
            });
        });
    } catch (error) {
        console.error('Error setting up resources listener:', error);
        return null;
    }
}

// Fetch single activity report with full details
export async function fetchSingleActivityReport(reportId) {
    try {
        const reportRef = doc(db, 'activityReports', reportId);
        const reportSnap = await getDoc(reportRef);
        
        if (reportSnap.exists()) {
            return {
                id: reportSnap.id,
                ...reportSnap.data()
            };
        } else {
            console.log('No such report found!');
            return null;
        }
    } catch (error) {
        console.error('Error fetching single activity report:', error);
        return null;
    }
}

// Clear cache (useful for manual refresh)
export function clearCache() {
    dataCache = {
        activityReports: null,
        preachingCategories: null,
        users: null,
        lastFetch: null
    };
}

// Gallery Image Functions

// Upload image to Firebase Storage and save metadata to Firestore
export async function uploadGalleryImage(file, category, title, userId) {
    try {
        console.log('=== UPLOAD PROCESS START ===');
        console.log('Upload parameters:', { 
            fileName: file.name, 
            fileSize: file.size, 
            fileType: file.type, 
            category, 
            title, 
            userId 
        });

        // Validate inputs
        if (!file) {
            console.error('Validation failed: No file provided');
            throw new Error('No file provided');
        }
        if (!category) {
            console.error('Validation failed: Category is required');
            throw new Error('Category is required');
        }
        if (!userId) {
            console.error('Validation failed: User ID is required');
            throw new Error('User ID is required');
        }

        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            console.error('Validation failed: File size exceeds 5MB limit', file.size);
            throw new Error('File size exceeds 5MB limit');
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            console.error('Validation failed: File must be an image', file.type);
            throw new Error('File must be an image');
        }

        console.log('✓ All validations passed');

        // Create a unique filename with better sanitization
        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const baseName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
        const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_'); // Replace all non-alphanumeric with underscore
        const filename = `${category}/${timestamp}_${sanitizedBaseName}.${fileExtension}`;
        
        console.log('Generated filename:', filename);
        console.log('Full storage path:', `gallery/${filename}`);
        
        // Test storage reference creation
        console.log('Creating storage reference...');
        const storageRef = ref(storage, `gallery/${filename}`);
        console.log('Storage reference created:', storageRef);
        
        // Upload file to Firebase Storage with detailed logging
        console.log('Starting Firebase Storage upload...');
        try {
            const snapshot = await uploadBytes(storageRef, file);
            console.log('✓ Upload to Storage successful:', snapshot);
        } catch (storageError) {
            console.error('❌ Storage upload failed:', {
                error: storageError.message,
                code: storageError.code,
                details: storageError
            });
            throw new Error(`Storage upload failed: ${storageError.message}`);
        }
        
        // Get download URL
        console.log('Getting download URL...');
        let downloadURL;
        try {
            downloadURL = await getDownloadURL(storageRef);
            console.log('✓ Download URL obtained:', downloadURL);
        } catch (urlError) {
            console.error('❌ Failed to get download URL:', urlError);
            throw new Error(`Failed to get download URL: ${urlError.message}`);
        }
        
        // Save image metadata to Firestore
        const imageData = {
            title: title || sanitizedBaseName,
            category: category, // 'mission' or 'activities'
            url: downloadURL,
            filename: filename,
            originalName: file.name,
            size: file.size,
            type: file.type,
            uploadedBy: userId,
            uploadedAt: new Date().toISOString(),
            createdAt: serverTimestamp(),
            date: new Date().toISOString().split('T')[0]
        };
        
        console.log('Saving metadata to Firestore:', imageData);
        try {
            const docRef = await addDoc(collection(db, 'galleryImages'), imageData);
            console.log('✓ Metadata saved successfully with ID:', docRef.id);
            
            console.log('=== UPLOAD PROCESS COMPLETE ===');
            return {
                id: docRef.id,
                ...imageData,
                createdAt: new Date() // For immediate display
            };
        } catch (firestoreError) {
            console.error('❌ Firestore save failed:', firestoreError);
            throw new Error(`Failed to save metadata: ${firestoreError.message}`);
        }
        
    } catch (error) {
        console.error('=== UPLOAD PROCESS FAILED ===');
        console.error('Detailed error uploading gallery image:', {
            error: error.message,
            code: error.code,
            stack: error.stack,
            file: file ? { name: file.name, size: file.size, type: file.type } : 'No file',
            category,
            userId
        });
        throw new Error(`Upload failed: ${error.message}`);
    }
}

// Fetch gallery images by category
export async function fetchGalleryImages(category = null) {
    try {
        console.log('=== FETCH GALLERY IMAGES START ===');
        console.log('Requested category:', category);
        
        const imagesRef = collection(db, 'galleryImages');
        console.log('Collection reference created:', imagesRef);
        
        let q;
        let querySnapshot;
        
        if (category) {
            console.log('Creating query with category filter:', category);
            
            // First try with orderBy (requires index)
            try {
                console.log('Attempting query with orderBy...');
                q = query(imagesRef, where('category', '==', category), orderBy('createdAt', 'desc'));
                querySnapshot = await getDocs(q);
                console.log('✓ Query with orderBy successful');
            } catch (queryError) {
                console.warn('❌ Query with orderBy failed (likely missing index):', queryError.message);
                
                // Fallback: try without orderBy
                try {
                    console.log('Trying fallback query without orderBy...');
                    q = query(imagesRef, where('category', '==', category));
                    querySnapshot = await getDocs(q);
                    console.log('✓ Fallback query without orderBy successful');
                } catch (fallbackError) {
                    console.error('❌ Even fallback query failed:', fallbackError);
                    throw fallbackError;
                }
            }
        } else {
            console.log('Creating query for all images');
            
            // First try with orderBy
            try {
                console.log('Attempting query with orderBy...');
                q = query(imagesRef, orderBy('createdAt', 'desc'));
                querySnapshot = await getDocs(q);
                console.log('✓ Query with orderBy successful');
            } catch (queryError) {
                console.warn('❌ Query with orderBy failed:', queryError.message);
                
                // Fallback: simple query without orderBy
                try {
                    console.log('Trying fallback query without orderBy...');
                    q = query(imagesRef);
                    querySnapshot = await getDocs(q);
                    console.log('✓ Fallback query without orderBy successful');
                } catch (fallbackError) {
                    console.error('❌ Even fallback query failed:', fallbackError);
                    throw fallbackError;
                }
            }
        }
        
        console.log('✓ Query executed successfully');
        console.log('Query snapshot size:', querySnapshot.size);
        console.log('Query snapshot empty:', querySnapshot.empty);
        
        if (querySnapshot.empty) {
            console.log('⚠️ No documents found in galleryImages collection');
            if (category) {
                console.log(`⚠️ No images found for category: ${category}`);
            }
        }
        
        const images = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            console.log('Processing document:', { 
                id: doc.id, 
                category: data.category,
                title: data.title,
                url: data.url ? 'URL present' : 'NO URL',
                createdAt: data.createdAt ? 'Timestamp present' : 'NO TIMESTAMP'
            });
            
            images.push({
                id: doc.id,
                ...data,
                // Convert Firestore timestamp to JavaScript Date for display
                uploadedAt: data.uploadedAt || data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                date: data.createdAt?.toDate?.()?.toISOString().split('T')[0] || data.date || 'N/A'
            });
        });
        
        // Manual sorting if orderBy wasn't used (when we had to use fallback)
        if (images.length > 1) {
            console.log('Applying manual sorting by creation date...');
            images.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(a.uploadedAt || 0);
                const dateB = b.createdAt?.toDate?.() || new Date(b.uploadedAt || 0);
                return dateB - dateA; // Descending order (newest first)
            });
            console.log('✓ Manual sorting applied');
        }
        
        console.log(`✓ Processed ${images.length} images for category '${category}'`);
        console.log('Sample image data:', images[0] || 'No images');
        console.log('=== FETCH GALLERY IMAGES END ===');
        
        return images;
    } catch (error) {
        console.error('=== FETCH GALLERY IMAGES FAILED ===');
        console.error('Error fetching gallery images:', {
            error: error.message,
            code: error.code,
            stack: error.stack,
            category
        });
        return [];
    }
}

// Debug function to check all gallery images in database
export async function debugGalleryImages() {
    try {
        console.log('=== DEBUGGING GALLERY IMAGES ===');
        const imagesRef = collection(db, 'galleryImages');
        const querySnapshot = await getDocs(imagesRef);
        
        console.log('Total gallery images in database:', querySnapshot.size);
        
        const imagesByCategory = {};
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const category = data.category || 'unknown';
            
            if (!imagesByCategory[category]) {
                imagesByCategory[category] = [];
            }
            
            imagesByCategory[category].push({
                id: doc.id,
                title: data.title,
                category: data.category,
                url: data.url,
                filename: data.filename,
                uploadedAt: data.uploadedAt || data.createdAt?.toDate?.()?.toISOString() || 'N/A'
            });
        });
        
        console.log('Images by category:', imagesByCategory);
        
        // Check specifically for activities category
        const activitiesImages = imagesByCategory['activities'] || [];
        console.log(`Found ${activitiesImages.length} images in 'activities' category:`, activitiesImages);
        
        return imagesByCategory;
    } catch (error) {
        console.error('Error debugging gallery images:', error);
        return {};
    }
}

// Delete gallery image from both Storage and Firestore
export async function deleteGalleryImage(imageId, filename) {
    try {
        // Delete from Firestore
        const imageRef = doc(db, 'galleryImages', imageId);
        await deleteDoc(imageRef);
        
        // Delete from Storage
        const storageRef = ref(storage, `gallery/${filename}`);
        await deleteObject(storageRef);
        
        console.log('Gallery image deleted successfully');
        return true;
    } catch (error) {
        console.error('Error deleting gallery image:', error);
        throw error;
    }
}

// Get user role from Firestore
export async function getUserRole(userId, userEmail = null) {
    try {
        console.log('Fetching user role for:', { userId, userEmail });
        const users = await fetchUsers();
        
        // First try to find user by userId (document ID)
        let userData = users[userId];
        console.log('User data by ID:', userData);
        
        // If not found by ID, try to find by email
        if (!userData && userEmail) {
            console.log('User not found by ID, searching by email:', userEmail);
            userData = Object.values(users).find(user => 
                user.email && user.email.toLowerCase() === userEmail.toLowerCase()
            );
            console.log('User data by email:', userData);
        }
        
        if (!userData) {
            console.log('No user data found in Firestore, defaulting to regular user');
            return 'user'; // Default role for users not in database
        }
        
        // Check for role field (with various possible field names)
        const role = userData.role || userData.userRole || userData.permission || userData.level || 'member';
        console.log('User role determined:', role);
        
        return role.toLowerCase(); // Normalize to lowercase for comparison
    } catch (error) {
        console.error('Error fetching user role:', error);
        return 'user'; // Default to regular user on error
    }
}

// Update user role in Firestore (admin function)
export async function updateUserRole(userId, newRole) {
    try {
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js');
        
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            role: newRole,
            updatedAt: new Date().toISOString()
        });
        
        // Clear cache to force refresh
        clearCache();
        
        console.log(`User role updated successfully: ${userId} -> ${newRole}`);
        return true;
    } catch (error) {
        console.error('Error updating user role:', error);
        throw error;
    }
}

// Check if current user has admin privileges
export async function checkAdminAccess(userId) {
    try {
        const userRole = await getUserRole(userId);
        return userRole === 'admin' || userRole === 'super_admin';
    } catch (error) {
        console.error('Error checking admin access:', error);
        return false;
    }
}

// Real-time listener for gallery images
export function listenToGalleryImages(category, callback) {
    try {
        console.log(`Setting up real-time listener for category: ${category}`);
        const imagesRef = collection(db, 'galleryImages');
        let q;
        let useOrderBy = false;
        
        if (category) {
            // First try with orderBy (requires index)
            try {
                console.log('Attempting real-time query with orderBy...');
                q = query(imagesRef, where('category', '==', category), orderBy('createdAt', 'desc'));
                useOrderBy = true;
                console.log('✓ Real-time query with orderBy created for category:', category);
            } catch (indexError) {
                console.warn('❌ Real-time orderBy query failed (likely missing index):', indexError.message);
                // Fallback: simple where query without orderBy
                console.log('Using fallback real-time query without orderBy...');
                q = query(imagesRef, where('category', '==', category));
                useOrderBy = false;
            }
        } else {
            // First try with orderBy
            try {
                console.log('Attempting real-time query with orderBy for all images...');
                q = query(imagesRef, orderBy('createdAt', 'desc'));
                useOrderBy = true;
                console.log('✓ Real-time query with orderBy created for all images');
            } catch (indexError) {
                console.warn('❌ Real-time orderBy query failed:', indexError.message);
                // Fallback: simple query without orderBy
                console.log('Using fallback real-time query without orderBy...');
                q = query(imagesRef);
                useOrderBy = false;
            }
        }
        
        return onSnapshot(q, (querySnapshot) => {
            console.log(`Real-time update: ${querySnapshot.size} images found for category '${category}'`);
            const images = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                console.log('Processing real-time image:', { 
                    id: doc.id, 
                    category: data.category, 
                    title: data.title,
                    hasUrl: !!data.url 
                });
                images.push({
                    id: doc.id,
                    ...data,
                    date: data.createdAt?.toDate?.()?.toISOString().split('T')[0] || data.date || 'N/A'
                });
            });
            
            // Manual sorting if orderBy wasn't used
            if (!useOrderBy && images.length > 1) {
                console.log('Applying manual sorting to real-time results...');
                images.sort((a, b) => {
                    const dateA = a.createdAt?.toDate?.() || new Date(a.uploadedAt || 0);
                    const dateB = b.createdAt?.toDate?.() || new Date(b.uploadedAt || 0);
                    return dateB - dateA; // Descending order (newest first)
                });
                console.log('✓ Manual sorting applied to real-time results');
            }
            
            console.log(`Calling callback with ${images.length} sorted images`);
            callback(images);
        }, (error) => {
            console.error('Real-time listener error:', error);
            
            // Check if it's an index error and try fallback
            if (error.code === 'failed-precondition' && error.message.includes('index')) {
                console.log('Index error detected in real-time listener, trying fallback query...');
                
                // Try setting up a simpler listener without orderBy
                try {
                    const fallbackQuery = category ? 
                        query(imagesRef, where('category', '==', category)) : 
                        query(imagesRef);
                    
                    return onSnapshot(fallbackQuery, (querySnapshot) => {
                        console.log(`Fallback real-time update: ${querySnapshot.size} images found`);
                        const images = [];
                        querySnapshot.forEach((doc) => {
                            const data = doc.data();
                            images.push({
                                id: doc.id,
                                ...data,
                                date: data.createdAt?.toDate?.()?.toISOString().split('T')[0] || data.date || 'N/A'
                            });
                        });
                        
                        // Manual sorting for fallback
                        if (images.length > 1) {
                            images.sort((a, b) => {
                                const dateA = a.createdAt?.toDate?.() || new Date(a.uploadedAt || 0);
                                const dateB = b.createdAt?.toDate?.() || new Date(b.uploadedAt || 0);
                                return dateB - dateA;
                            });
                        }
                        
                        console.log(`Fallback callback with ${images.length} sorted images`);
                        callback(images);
                    });
                } catch (fallbackError) {
                    console.error('Fallback real-time listener also failed:', fallbackError);
                }
            }
            
            // Final fallback: try to fetch images manually
            fetchGalleryImages(category).then(images => {
                console.log('Manual fallback fetch successful, calling callback with', images.length, 'images');
                callback(images);
            }).catch(fetchError => {
                console.error('Manual fallback fetch also failed:', fetchError);
                callback([]); // Return empty array as last resort
            });
        });
    } catch (error) {
        console.error('Error setting up gallery images listener:', error);
        return null;
    }
}
