// Firebase data operations for Preaching Impact and Dashboard
import { db } from './firebase-config.js';
import { 
    collection, 
    getDocs, 
    query, 
    orderBy, 
    limit, 
    where,
    onSnapshot,
    doc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

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

// Clear cache (useful for manual refresh)
export function clearCache() {
    dataCache = {
        activityReports: null,
        preachingCategories: null,
        users: null,
        lastFetch: null
    };
}
