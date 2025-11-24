// Agent object now holds both ad-counter ID and the permission search URL
const agents = {
    "Mehedi": {
        id: "5300426f-74f8-45fb-8a13-2cf5b3a90e35",
        permission_url: "https://admin.bikroy.com/admins?search=hasan.myol%40bikroy.com&permission="
    },
    "Yeamin": {
        id: "2ddd587c-53ce-4359-a3c4-9c62e7246913",
        permission_url: "https://admin.bikroy.com/admins?search=yeamin.myol%40bikroy.com&permission="
    },
    "Utsow": {
        id: "ddc4647e-1ff0-4ab5-86a4-9115c09238d2",
        permission_url: "https://admin.bikroy.com/admins?search=utsow.myol%40bikroy.com%09&permission="
    },
    "Udoy": {
        id: "b0199965-c48f-41a4-8ef7-bb72fe59ad19",
        permission_url: "https://admin.bikroy.com/admins?search=udoy.myol%40bikroy.com%09&permission="
    },
    "Salahuddin": {
        id: "bf17fa33-21db-4c3a-94f6-cc9632285a2a",
        permission_url: "https://admin.bikroy.com/admins?search=salahuddin.myol%40bikroy.com%09&permission="
    },
    "Halal": {
        id: "17410938-7233-45e3-b127-0ab1ce257b11",
        permission_url: "https://admin.bikroy.com/admins?search=halal.myol%40bikroy.com&permission="
    },
    "Jisan": {
        id: "58f389df-f6be-4f12-96d2-0254fc3640b0",
        permission_url: "https://admin.bikroy.com/admins?search=jisan.myol%40bikroy.com%09&permission="
    },
    "Sarnali": {
        id: "dbac7bc5-1b6f-4498-9978-5ae7f9cf796c",
        permission_url: "https://admin.bikroy.com/admins?search=sarnali.myol%40bikroy.com%09&permission="
    },
    "Asif": {
        id: "1dcdbdb7-04a7-47d8-9819-0156938964be",
        permission_url: "https://admin.bikroy.com/admins?search=asif.myol%40bikroy.com%09&permission="
    },
    "Anik": {
        id: "f3c261a5-fe74-45ec-82d4-7f5218436e4d",
        permission_url: "https://admin.bikroy.com/admins?search=anik.myol%40bikroy.com%09&permission="
    },
    "Riazul": {
        id: "ca7e9fff-957a-4726-bee8-c9ce235abf11",
        permission_url: "https://admin.bikroy.com/admins?search=riazul.ihsl%40bikroy.com%09&permission="
    },
    "Sonjoy": {
        id: "724f4be9-3130-470c-8827-f8197322f99e",
        permission_url: "https://admin.bikroy.com/admins?search=mondol.myol%40bikroy.com%09&permission="
    },
    "Roni": {
        id: "7585f878-a596-43ed-a7e8-ab49ee257e22",
        permission_url: null // No link was provided for Roni
    },
    "Deb": {
        id: "4c658d2c-efb2-46b5-a4b6-0842df96ca58",
        permission_url: "https://admin.bikroy.com/admins?search=deb.myol%40bikroy.com&permission="
    },
    "Minhazul": {
        id: "1f1bdb01-367e-49df-9678-ffb3f01d4624",
        permission_url: "https://admin.bikroy.com/admins?search=minhazul.myol%40bikroy.com&permission="
    }
};

// On extension install/update, initialize notification timestamps and set alarms
chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed/updated.");
    chrome.storage.local.set({ notificationTimestamps: {} });
    // Create an alarm to refresh review queues every 1 minute.
    chrome.alarms.create('reviewCountRefresh', { delayInMinutes: 1, periodInMinutes: 1 });
});

// Listener for Internal Popup Messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startTracking') {
        startTracking();
        sendResponse({status: 'started'});
    } else if (request.action === 'refreshNow') {
        updateReviewCounts();
        sendResponse({status: 'refreshing queues'});
    } else if (request.action === 'refreshAgentStats') {
        updateAllAgentData();
        sendResponse({status: 'refreshing agents'});
    } else if (request.action === 'resetStats') {
        resetStats();
        sendResponse({status: 'resetting'});
    } else if (request.action === 'stopTracking') {
        stopTracking();
        sendResponse({status: 'stopped'});
    } else if (request.action === 'getLivePermissions') {
        fetchPermissionsForAgent(request.agentName, true)
            .then(permissions => sendResponse({ permissions }))
            .catch(error => sendResponse({ error: error.message }));
    } else if (request.action === 'updatePermissions') {
        updatePermissionsForAgent(request.agentName, request.permissions)
            .then(() => sendResponse({ status: 'success' }))
            .catch(error => sendResponse({ status: 'error', error: message }));
    }
    return true; // Indicates async response
});

// --- NEW LISTENER: Listener for External Web Dashboard Messages ---
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    // 1. Handle Handshake
    if (request.action === 'handshake') {
        sendResponse({ status: 'connected', version: '1.2' });
        return true; 
    }

    // 2. Handle Data Fetching
    if (request.action === 'getData') {
        chrome.storage.local.get(['agentData', 'reviewCounts', 'isRunning', 'selectedAgents'], (result) => {
            sendResponse(result);
        });
        return true; 
    }

    // 3. Handle Commands (Start/Stop/Refresh)
    if (request.action === 'command') {
        if (request.command === 'start') {
            // Dashboard sends payload of agents to track
            const agentsToTrack = request.payload || [];
            chrome.storage.local.set({ selectedAgents: agentsToTrack, isRunning: true }, () => {
                startTracking(); 
                sendResponse({ success: true });
            });
        } 
        else if (request.command === 'stop') {
            stopTracking();
            sendResponse({ success: true });
        } 
        else if (request.command === 'refresh') {
            updateReviewCounts();
            updateAllAgentData();
            sendResponse({ success: true });
        }
        return true;
    }
});

// Alarm listener handles both queue and agent alarms
chrome.alarms.onAlarm.addListener((alarm) => {
    // Handle queue refresh alarm independently of agent tracking
    if (alarm.name === 'reviewCountRefresh') {
        console.log('ALARM: 1 minute review queue refresh triggered.');
        updateReviewCounts();
        return;
    }

    // For agent-related alarms, check if tracking is active
    chrome.storage.local.get('isRunning', (result) => {
        if (!result.isRunning) return;

        if (alarm.name === 'adRefresh') {
            console.log('ALARM: 15 minute agent data refresh triggered.');
            updateAllAgentData();
        } else if (alarm.name === 'hourlyReset') {
            console.log('ALARM: Hourly count reset triggered.');
            resetHourlyCounts();
        } else if (alarm.name === 'inactivityCheck') {
             console.log('ALARM: Inactivity Check.');
             checkInactivity();
        }
    });
});


function stopTracking() {
    // Clear only agent-related alarms
    chrome.alarms.clear('adRefresh');
    chrome.alarms.clear('hourlyReset');
    chrome.alarms.clear('inactivityCheck');
    // Set agent data to empty and tracking to false
    chrome.storage.local.set({ isRunning: false, agentData: {} });
    console.log('Agent tracking stopped. Agent data and alarms cleared.');
}

function startTracking() {
    console.log('Starting agent tracking process...');
    chrome.storage.local.get('selectedAgents', (result) => {
        if (!result.selectedAgents || result.selectedAgents.length === 0) {
            chrome.storage.local.set({ isRunning: false });
            return;
        }
        
        const initialData = {};
        const now = Date.now();
        result.selectedAgents.forEach(name => {
            initialData[name] = { 
                totalAds: 0, 
                lastTotal: 0, 
                thisHourAds: 0, 
                lastHourAds: 0, 
                cumulativeNewAds: 0, 
                permissions: '...',
                lastActiveTime: now // Initialize last active time to NOW
            };
        });

        chrome.storage.local.set({ agentData: initialData, isRunning: true }, () => {
            updateAllAgentData(true); // Initial fetch for agents
            
            // --- Set up agent-specific alarms ---
            chrome.alarms.create('adRefresh', { delayInMinutes: 1, periodInMinutes: 15 });
            chrome.alarms.create('inactivityCheck', { delayInMinutes: 15, periodInMinutes: 15 }); // Check every 15 mins
            const nowTime = new Date();
            const minutesToNextHour = 60 - nowTime.getMinutes();
            chrome.alarms.create('hourlyReset', { delayInMinutes: minutesToNextHour, periodInMinutes: 60 });
        });
    });
}

function resetStats() {
    console.log('Resetting agent statistics...');
    // Clear and then restart agent tracking
    chrome.alarms.clear('adRefresh');
    chrome.alarms.clear('hourlyReset');
    chrome.alarms.clear('inactivityCheck');
    chrome.alarms.clear('hourlyReset', () => {
        startTracking();
    });
}

async function updateReviewCounts() {
    console.log("Fetching review queue counts...");
    let reviewTab;
    try {
        reviewTab = await chrome.tabs.create({ url: "https://admin.bikroy.com/review/email", active: false });
        await new Promise(resolve => setTimeout(resolve, 1000));

        const injectionResults = await chrome.scripting.executeScript({
            target: { tabId: reviewTab.id },
            function: () => {
                const counts = {};
                const countElements = document.querySelectorAll('.review-tabs .review-count');
                countElements.forEach(span => {
                    const type = span.dataset.type;
                    const count = parseInt(span.textContent.trim().replace(/,/g, ''), 10);
                    if (type && !isNaN(count)) counts[type] = count;
                });
                return counts;
            }
        });

        const counts = injectionResults[0].result;
        if (!counts || Object.keys(counts).length === 0) {
            throw new Error("No review count elements found.");
        }
        
        await chrome.storage.local.set({ reviewCounts: counts });
        console.log("Review counts updated:", counts);

        // --- Notification Logic for High Queues ---
        const { notificationTimestamps: storedTimestamps } = await chrome.storage.local.get({ notificationTimestamps: {} });
        const newTimestamps = { ...storedTimestamps };
        let notificationSent = false;

        const notificationThresholds = {
            'member': 25,
            'listing_fee': 30,
            'general': 300,
        };
        const snoozeDurations = { // in milliseconds
            'member': 15 * 60 * 1000,
            'listing_fee': 15 * 60 * 1000,
            'general': 30 * 60 * 1000,
        };

        const triggeredQueues = [];
        for (const queue in notificationThresholds) {
            const threshold = notificationThresholds[queue];
            const snooze = snoozeDurations[queue];
            const lastNotified = newTimestamps[queue] || 0;
            const count = counts[queue] || 0;

            if (count >= threshold && (Date.now() - lastNotified > snooze)) {
                triggeredQueues.push(queue.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()));
                newTimestamps[queue] = Date.now();
                notificationSent = true;
            }
        }
        
        if (triggeredQueues.length > 0) {
            const notificationMessage = `High volume in: ${triggeredQueues.join(', ')}. Needs to be cleared.`;
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'images/icon128.png',
                title: 'Review Queue Alert',
                message: notificationMessage,
                priority: 2
            });
        }
        
        if (notificationSent) {
            await chrome.storage.local.set({ notificationTimestamps: newTimestamps });
        }

    } catch (error) {
        console.error("Error fetching review counts:", error);
        await chrome.storage.local.set({ reviewCounts: {} });
    } finally {
        if (reviewTab) await chrome.tabs.remove(reviewTab.id);
    }
}


async function updateAllAgentData(forceInitial = false) {
    const { selectedAgents, agentData: currentData } = await chrome.storage.local.get(['selectedAgents', 'agentData']);

    if (!selectedAgents || selectedAgents.length === 0) {
        stopTracking();
        return;
    }

    const newAgentData = JSON.parse(JSON.stringify(currentData || {}));
    const currentTime = Date.now();

    for (const name of selectedAgents) {
        if (!agents[name]) continue;
        
        try {
            const agentId = agents[name].id;
            const adCountUrl = `https://admin.bikroy.com/search/item?submitted=1&search=&event_type_from=&event_type_to=&event_type=&category=&rejection=&location=&admin_user=${agentId}`;
            
            const response = await fetch(adCountUrl);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            
            const htmlText = await response.text();
            const match = htmlText.match(/of ([\d,]+) results/);
            const totalAds = match && match[1] ? parseInt(match[1].replace(/,/g, ''), 10) : null;

            if (totalAds !== null) {
                const agentStats = newAgentData[name] || {};
                
                // FIX: If lastTotal is 0 or missing, treat this as the INITIAL baseline.
                // This prevents the "This Hour" count from jumping to 160,000 immediately.
                if (forceInitial || !agentStats.lastTotal || agentStats.lastTotal === 0) {
                    agentStats.lastTotal = totalAds;
                    agentStats.thisHourAds = 0; // Reset counters on initial
                    agentStats.cumulativeNewAds = 0;
                    agentStats.lastActiveTime = currentTime; // Reset activity timer
                } else {
                    if (totalAds > agentStats.lastTotal) {
                        const newAds = totalAds - agentStats.lastTotal;
                        agentStats.thisHourAds = (agentStats.thisHourAds || 0) + newAds;
                        agentStats.cumulativeNewAds = (agentStats.cumulativeNewAds || 0) + newAds;
                        agentStats.lastActiveTime = currentTime; // Update activity timestamp
                    }
                }
                
                agentStats.totalAds = totalAds; // Keep track of raw total for debug
                agentStats.lastTotal = totalAds; // Update baseline for next compare
                newAgentData[name] = agentStats;
            }
        } catch (error) {
            console.error(`Error fetching ad count for ${name}:`, error);
        }

        const permissions = await fetchPermissionsForAgent(name);
        if (newAgentData[name]) {
            newAgentData[name].permissions = permissions;
        }
    }
    
    await chrome.storage.local.set({ agentData: newAgentData });
}

// --- Check Inactivity Function ---
async function checkInactivity() {
    const { agentData, isRunning } = await chrome.storage.local.get(['agentData', 'isRunning']);
    if (!isRunning || !agentData) return;

    const INACTIVITY_LIMIT = 15 * 60 * 1000; // 15 Minutes in MS
    const now = Date.now();
    const inactiveAgents = [];

    for (const name in agentData) {
        const agent = agentData[name];
        // If lastActiveTime is missing, default to now (to be safe)
        const lastActive = agent.lastActiveTime || now;
        
        if (now - lastActive > INACTIVITY_LIMIT) {
            inactiveAgents.push(name);
        }
    }

    if (inactiveAgents.length > 0) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon128.png',
            title: 'Agent Inactivity Alert',
            message: `${inactiveAgents.join(', ')} inactive for over 15 mins!`,
            priority: 2
        });
    }
}

function getPermissionsFromPage() {
    const checked = Array.from(document.querySelectorAll('.permissions .ui-checkbox:checked'));
    return checked.map(checkbox => checkbox.parentElement.textContent.trim());
}

function applyAndSaveChanges(permissionsToSet) {
    for (const [permissionValue, shouldBeChecked] of Object.entries(permissionsToSet)) {
        const checkbox = document.querySelector(`input[value="${permissionValue}"]`);
        if (checkbox) {
            if (checkbox.checked !== shouldBeChecked) {
                checkbox.parentElement.click();
            }
        }
    }
    const saveButton = document.querySelector('button.ui-btn.is-primary');
    if (saveButton) {
        saveButton.click();
    } else {
        throw new Error('Save button not found.');
    }
}

async function fetchPermissionsForAgent(name, rawOutput = false) {
    const agentInfo = agents[name];
    if (!agentInfo.permission_url) return rawOutput ? [] : 'N/A';
    let searchTab;
    try {
        searchTab = await chrome.tabs.create({ url: agentInfo.permission_url, active: false });
        await new Promise(resolve => setTimeout(resolve, 1000));
        let editLink;
        try {
            const editLinkResults = await chrome.scripting.executeScript({
                target: { tabId: searchTab.id },
                function: () => document.querySelector('a.ui-btn.is-standard.edit.is-s')?.getAttribute('href') || null,
            });
            editLink = editLinkResults?.[0]?.result;
        } finally {
            if (searchTab) await chrome.tabs.remove(searchTab.id);
        }

        if (!editLink) return rawOutput ? [] : 'User Not Found';

        const permissionPageUrl = 'https://admin.bikroy.com' + editLink;
        let permResults;
        let permTab;
        try {
            permTab = await chrome.tabs.create({ url: permissionPageUrl, active: false });
            await new Promise(resolve => setTimeout(resolve, 1000));
            permResults = await chrome.scripting.executeScript({
                target: { tabId: permTab.id },
                function: getPermissionsFromPage,
            });
        } finally {
             if (permTab) await chrome.tabs.remove(permTab.id);
        }
        
        const checkedPermissions = permResults?.[0]?.result;
        if (!checkedPermissions) return rawOutput ? [] : 'Error';

        if (rawOutput) {
            return checkedPermissions;
        }

        const permissionMap = { 
            'Member': 'M', 'Listing fee': 'L', 'General': 'G', 
            'Edited': 'E', 'Verification': 'V' 
        };
        const permissionsString = checkedPermissions
            .map(p => permissionMap[p])
            .filter(Boolean)
            .join(' ');
        
        return permissionsString || 'None';

    } catch (error) {
        console.error(`Error fetching permissions for ${name}:`, error);
        if (searchTab) await chrome.tabs.remove(searchTab.id).catch(e => console.error("Could not remove searchTab", e));
        return rawOutput ? [] : 'Perms Error';
    }
}

async function updatePermissionsForAgent(name, newPermissions) {
    console.log(`Starting permission update for ${name}`);
    const agentInfo = agents[name];
    if (!agentInfo?.permission_url) {
        throw new Error('Agent not found or has no permission URL.');
    }

    let searchTab;
    try {
        searchTab = await chrome.tabs.create({ url: agentInfo.permission_url, active: false });
        await new Promise(resolve => setTimeout(resolve, 1000));
        let editLink;
        try {
            const editLinkResults = await chrome.scripting.executeScript({
                target: { tabId: searchTab.id },
                function: () => document.querySelector('a.ui-btn.is-standard.edit.is-s')?.getAttribute('href') || null,
            });
            editLink = editLinkResults?.[0]?.result;
        } finally {
            if(searchTab) await chrome.tabs.remove(searchTab.id);
        }

        if (!editLink) {
            throw new Error('Could not find the user edit link.');
        }

        const permissionPageUrl = 'https://admin.bikroy.com' + editLink;
        let permTab;
        try {
            permTab = await chrome.tabs.create({ url: permissionPageUrl, active: false });
            await new Promise(resolve => setTimeout(resolve, 1000));
            await chrome.scripting.executeScript({
                target: { tabId: permTab.id },
                function: applyAndSaveChanges,
                args: [newPermissions],
            });
            await new Promise(resolve => setTimeout(resolve, 1500));
        } finally {
            if (permTab) await chrome.tabs.remove(permTab.id);
        }
        
        console.log(`Permissions updated for ${name}. Refreshing data...`);
        const { agentData } = await chrome.storage.local.get('agentData');
        if (agentData?.[name]) {
            agentData[name].permissions = await fetchPermissionsForAgent(name);
            await chrome.storage.local.set({ agentData });
        }
    } catch (error) {
        console.error("Error updating permissions:", error);
        if (searchTab) await chrome.tabs.remove(searchTab.id).catch(e => console.error("Could not remove searchTab", e));
        throw error;
    }
}

async function resetHourlyCounts() {
    const { agentData } = await chrome.storage.local.get('agentData');
    if (agentData) {
        for (const name in agentData) {
            agentData[name].lastHourAds = agentData[name].thisHourAds || 0;
            agentData[name].thisHourAds = 0;
        }
        chrome.storage.local.set({ agentData });
        console.log('Hourly counts have been reset.');
    }
}
