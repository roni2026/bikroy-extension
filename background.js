import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getDatabase, ref, set, update, onValue } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js';
import firebaseConfig from './firebase-config.js';

// --- 1. FIREBASE INITIALIZATION ---
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- 2. AGENTS CONFIGURATION ---
const agents = {
    "Mehedi": { id: "5300426f-74f8-45fb-8a13-2cf5b3a90e35", permission_url: "https://admin.bikroy.com/admins?search=hasan.myol%40bikroy.com&permission=" },
    "Yeamin": { id: "2ddd587c-53ce-4359-a3c4-9c62e7246913", permission_url: "https://admin.bikroy.com/admins?search=yeamin.myol%40bikroy.com&permission=" },
    "Utsow": { id: "ddc4647e-1ff0-4ab5-86a4-9115c09238d2", permission_url: "https://admin.bikroy.com/admins?search=utsow.myol%40bikroy.com%09&permission=" },
    "Udoy": { id: "b0199965-c48f-41a4-8ef7-bb72fe59ad19", permission_url: "https://admin.bikroy.com/admins?search=udoy.myol%40bikroy.com%09&permission=" },
    "Salahuddin": { id: "bf17fa33-21db-4c3a-94f6-cc9632285a2a", permission_url: "https://admin.bikroy.com/admins?search=salahuddin.myol%40bikroy.com%09&permission=" },
    "Halal": { id: "17410938-7233-45e3-b127-0ab1ce257b11", permission_url: "https://admin.bikroy.com/admins?search=halal.myol%40bikroy.com&permission=" },
    "Jisan": { id: "58f389df-f6be-4f12-96d2-0254fc3640b0", permission_url: "https://admin.bikroy.com/admins?search=jisan.myol%40bikroy.com%09&permission=" },
    "Sarnali": { id: "dbac7bc5-1b6f-4498-9978-5ae7f9cf796c", permission_url: "https://admin.bikroy.com/admins?search=sarnali.myol%40bikroy.com%09&permission=" },
    "Asif": { id: "1dcdbdb7-04a7-47d8-9819-0156938964be", permission_url: "https://admin.bikroy.com/admins?search=asif.myol%40bikroy.com%09&permission=" },
    "Anik": { id: "f3c261a5-fe74-45ec-82d4-7f5218436e4d", permission_url: "https://admin.bikroy.com/admins?search=anik.myol%40bikroy.com%09&permission=" },
    "Riazul": { id: "ca7e9fff-957a-4726-bee8-c9ce235abf11", permission_url: "https://admin.bikroy.com/admins?search=riazul.ihsl%40bikroy.com%09&permission=" },
    "Sonjoy": { id: "724f4be9-3130-470c-8827-f8197322f99e", permission_url: "https://admin.bikroy.com/admins?search=mondol.myol%40bikroy.com%09&permission=" },
    "Roni": { id: "7585f878-a596-43ed-a7e8-ab49ee257e22", permission_url: null },
    "Deb": { id: "4c658d2c-efb2-46b5-a4b6-0842df96ca58", permission_url: "https://admin.bikroy.com/admins?search=deb.myol%40bikroy.com&permission=" },
    "Minhazul": { id: "1f1bdb01-367e-49df-9678-ffb3f01d4624", permission_url: "https://admin.bikroy.com/admins?search=minhazul.myol%40bikroy.com&permission=" }
};

// --- 3. EVENT LISTENERS ---

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ notificationTimestamps: {}, sessionLogs: [] });
    chrome.alarms.create('reviewCountRefresh', { delayInMinutes: 1, periodInMinutes: 1 });
});

// A. INTERNAL MESSAGES (Extension Popup)
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
    } else if (request.action === 'updatePermissions') {
        updatePermissionsForAgent(request.agentName, request.permissions)
            .then(() => sendResponse({ status: 'success' }))
            .catch(error => sendResponse({ status: 'error', error: 'Update failed' }));
    }
    return true; 
});

// B. EXTERNAL MESSAGES (Web Dashboard) - NEW CODE ADDED HERE
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    // 1. Handshake (Connection Check)
    if (request.action === 'handshake') {
        sendResponse({ status: 'connected', version: '1.4' });
    } 
    // 2. Data Fetch (Dashboard polling)
    else if (request.action === 'getData') {
        chrome.storage.local.get(['agentData', 'reviewCounts', 'isRunning', 'selectedAgents', 'sessionLogs'], (result) => {
            sendResponse(result || {});
        });
    } 
    // 3. Commands (Start/Stop/Refresh from Dashboard)
    else if (request.action === 'command') {
        if (request.command === 'start') {
            chrome.storage.local.set({ selectedAgents: request.payload, isRunning: true }, () => {
                startTracking();
                sendResponse({ status: 'started' });
            });
        } else if (request.command === 'stop') {
            stopTracking();
            sendResponse({ status: 'stopped' });
        } else if (request.command === 'refresh') {
            updateReviewCounts();
            updateAllAgentData();
            sendResponse({ status: 'refreshing' });
        } else if (request.command === 'clearLogs') {
            chrome.storage.local.set({ sessionLogs: [] }, () => {
                syncToFirebase();
                sendResponse({ status: 'cleared' });
            });
        }
    }
    return true; 
});

// Listener for Firebase Commands (Android App)
const commandsRef = ref(db, 'commands');
onValue(commandsRef, (snapshot) => {
    const cmd = snapshot.val();
    if (!cmd) return;

    if (cmd.action === 'start') {
        chrome.storage.local.set({ selectedAgents: cmd.payload, isRunning: true }, () => {
            startTracking();
        });
    } else if (cmd.action === 'stop') {
        stopTracking();
    } else if (cmd.action === 'refresh') {
        updateReviewCounts();
        updateAllAgentData();
    } else if (cmd.action === 'clearLogs') {
        chrome.storage.local.set({ sessionLogs: [] }, () => {
            syncToFirebase();
        });
    }

    set(ref(db, 'commands'), null);
});


// Alarm Listener
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'reviewCountRefresh') {
        updateReviewCounts();
        return;
    }

    chrome.storage.local.get('isRunning', (result) => {
        if (!result.isRunning) return;

        if (alarm.name === 'adRefresh') {
            updateAllAgentData();
        } else if (alarm.name === 'hourlyReset') {
            resetHourlyCounts();
        } else if (alarm.name === 'inactivityCheck') {
             checkInactivity();
        }
    });
});

// --- 4. CORE FUNCTIONS ---

async function syncToFirebase() {
    const { agentData, reviewCounts, isRunning, sessionLogs } = await chrome.storage.local.get(['agentData', 'reviewCounts', 'isRunning', 'sessionLogs']);
    
    update(ref(db, 'status'), {
        lastUpdated: Date.now(),
        isRunning: isRunning || false,
        agentData: agentData || {},
        reviewCounts: reviewCounts || {},
        sessionLogs: sessionLogs || []
    });
}

function stopTracking() {
    chrome.alarms.clear('adRefresh');
    chrome.alarms.clear('hourlyReset');
    chrome.alarms.clear('inactivityCheck');
    chrome.storage.local.set({ isRunning: false, agentData: {} }, () => {
        syncToFirebase();
    });
}

function startTracking() {
    chrome.storage.local.get('selectedAgents', (result) => {
        if (!result.selectedAgents || result.selectedAgents.length === 0) {
            chrome.storage.local.set({ isRunning: false });
            return;
        }
        
        const initialData = {};
        const now = Date.now();
        result.selectedAgents.forEach(name => {
            initialData[name] = { 
                totalAds: 0, lastTotal: 0, thisHourAds: 0, lastHourAds: 0, 
                cumulativeNewAds: 0, permissions: '...', lastActiveTime: now, lastLogTime: 0 
            };
        });

        chrome.storage.local.set({ agentData: initialData, isRunning: true, sessionLogs: [] }, () => {
            updateAllAgentData(true);
            
            chrome.alarms.create('adRefresh', { delayInMinutes: 1, periodInMinutes: 15 });
            chrome.alarms.create('inactivityCheck', { delayInMinutes: 5, periodInMinutes: 5 });
            
            const nowTime = new Date();
            const minutesToNextHour = 60 - nowTime.getMinutes();
            chrome.alarms.create('hourlyReset', { delayInMinutes: minutesToNextHour, periodInMinutes: 60 });
            
            syncToFirebase();
        });
    });
}

function resetStats() {
    chrome.alarms.clear('adRefresh');
    chrome.alarms.clear('hourlyReset');
    chrome.alarms.clear('inactivityCheck');
    chrome.alarms.clear('hourlyReset', () => {
        startTracking();
    });
}

async function updateReviewCounts() {
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
        if (counts) {
            await chrome.storage.local.set({ reviewCounts: counts });
            syncToFirebase();
        }
    } catch (error) {
        console.error("Error fetching review counts:", error);
    } finally {
        if (reviewTab) await chrome.tabs.remove(reviewTab.id);
    }
}

async function updateAllAgentData(forceInitial = false) {
    const { selectedAgents, agentData: currentData } = await chrome.storage.local.get(['selectedAgents', 'agentData']);
    if (!selectedAgents || selectedAgents.length === 0) { stopTracking(); return; }

    const newAgentData = JSON.parse(JSON.stringify(currentData || {}));
    const currentTime = Date.now();

    for (const name of selectedAgents) {
        if (!agents[name]) continue;
        
        try {
            const agentId = agents[name].id;
            const adCountUrl = `https://admin.bikroy.com/search/item?submitted=1&search=&event_type_from=&event_type_to=&event_type=&category=&rejection=&location=&admin_user=${agentId}`;
            
            const response = await fetch(adCountUrl);
            if (!response.ok) throw new Error(`HTTP`);
            
            const htmlText = await response.text();
            const match = htmlText.match(/of ([\d,]+) results/);
            const totalAds = match && match[1] ? parseInt(match[1].replace(/,/g, ''), 10) : null;

            if (totalAds !== null) {
                const agentStats = newAgentData[name] || {};
                
                if (forceInitial || !agentStats.lastTotal || agentStats.lastTotal === 0) {
                    agentStats.lastTotal = totalAds;
                    agentStats.thisHourAds = 0;
                    agentStats.cumulativeNewAds = 0; 
                    agentStats.lastActiveTime = currentTime;
                } else {
                    if (totalAds > agentStats.lastTotal) {
                        const newAds = totalAds - agentStats.lastTotal;
                        agentStats.thisHourAds = (agentStats.thisHourAds || 0) + newAds;
                        agentStats.cumulativeNewAds = (agentStats.cumulativeNewAds || 0) + newAds;
                        agentStats.lastActiveTime = currentTime; 
                    }
                }
                
                agentStats.totalAds = totalAds; 
                agentStats.lastTotal = totalAds; 
                newAgentData[name] = agentStats;
            }
        } catch (error) { console.error(error); }

        const permissions = await fetchPermissionsForAgent(name);
        if (newAgentData[name]) newAgentData[name].permissions = permissions;
    }
    
    await chrome.storage.local.set({ agentData: newAgentData });
    syncToFirebase();
}

async function checkInactivity() {
    const { agentData, isRunning, sessionLogs } = await chrome.storage.local.get(['agentData', 'isRunning', 'sessionLogs']);
    if (!isRunning || !agentData) return;

    const now = Date.now();
    let logsUpdated = false;
    const currentLogs = sessionLogs || [];

    for (const name in agentData) {
        const agent = agentData[name];
        const lastActive = agent.lastActiveTime || now;
        const diff = now - lastActive;
        const minsInactive = Math.floor(diff / 60000);
        
        // Log at 15m, 30m, 60m thresholds
        if (minsInactive >= 15) {
            const lastLog = agent.lastLogTime || 0;
            const timeSinceLastLog = now - lastLog;
            
            // Log if we haven't logged for this agent in 14 minutes
            if (timeSinceLastLog > 14 * 60 * 1000) {
                const date = new Date();
                const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                currentLogs.unshift({
                    type: 'alert',
                    time: timeString,
                    agent: name,
                    msg: `Inactive for ${minsInactive} minutes`
                });
                
                agent.lastLogTime = now;
                logsUpdated = true;

                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'images/icon128.png',
                    title: 'Inactivity Alert',
                    message: `${name} inactive for ${minsInactive} mins!`,
                    priority: 2
                });
            }
        }
    }

    if (logsUpdated) {
        if (currentLogs.length > 50) currentLogs.length = 50;
        await chrome.storage.local.set({ agentData, sessionLogs: currentLogs });
        syncToFirebase();
    }
}

async function resetHourlyCounts() {
    const { agentData, sessionLogs } = await chrome.storage.local.get(['agentData', 'sessionLogs']);
    if (agentData) {
        const currentLogs = sessionLogs || [];
        const date = new Date();
        const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        currentLogs.unshift({
            type: 'info',
            time: timeString,
            agent: 'SYSTEM',
            msg: `Hourly Reset Completed`
        });

        for (const name in agentData) {
            agentData[name].lastHourAds = agentData[name].thisHourAds || 0;
            agentData[name].thisHourAds = 0;
        }

        await chrome.storage.local.set({ agentData, sessionLogs: currentLogs });
        syncToFirebase();
    }
}

// --- 5. PERMISSION UTILS ---

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

        if (rawOutput) return checkedPermissions;

        const permissionMap = { 'Member': 'M', 'Listing fee': 'L', 'General': 'G', 'Edited': 'E', 'Verification': 'V' };
        const permissionsString = checkedPermissions.map(p => permissionMap[p]).filter(Boolean).join(' ');
        
        return permissionsString || 'None';

    } catch (error) {
        if (searchTab) await chrome.tabs.remove(searchTab.id).catch(e => console.error(e));
        return rawOutput ? [] : 'Perms Error';
    }
}

function getPermissionsFromPage() {
    const checked = Array.from(document.querySelectorAll('.permissions .ui-checkbox:checked'));
    return checked.map(checkbox => checkbox.parentElement.textContent.trim());
}

function applyAndSaveChanges(permissionsToSet) {
    for (const [permissionValue, shouldBeChecked] of Object.entries(permissionsToSet)) {
        const checkbox = document.querySelector(`input[value="${permissionValue}"]`);
        if (checkbox && checkbox.checked !== shouldBeChecked) {
            checkbox.parentElement.click();
        }
    }
    const saveButton = document.querySelector('button.ui-btn.is-primary');
    if (saveButton) saveButton.click();
}

async function updatePermissionsForAgent(name, newPermissions) {
    const agentInfo = agents[name];
    if (!agentInfo?.permission_url) throw new Error('No permission URL.');

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

        if (!editLink) throw new Error('No edit link.');

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
        
        const { agentData } = await chrome.storage.local.get('agentData');
        if (agentData?.[name]) {
            agentData[name].permissions = await fetchPermissionsForAgent(name);
            await chrome.storage.local.set({ agentData });
            syncToFirebase();
        }
    } catch (error) {
        if (searchTab) await chrome.tabs.remove(searchTab.id).catch(e => console.error(e));
        throw error;
    }
}
