document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const isPoppedOut = urlParams.get('isPoppedOut') === 'true';

    // This list must be kept in sync with background.js
    const agents = {
        "Mehedi": "...", "Yeamin": "...", "Utsow": "...", "Udoy": "...", "Salahuddin": "...", 
        "Halal": "...", "Jisan": "...", "Sarnali": "...", "Asif": "...", "Anik": "...", 
        "Riazul": "...", "Sonjoy": "...", "Roni": "...", "Deb": "...", "Minhazul": "..."
    };

    const ALL_PERMISSIONS_MAP = {
        'Member': 'review_items:member', 'Listing fee': 'review_items:listing_fee',
        'General': 'review_items:general', 'Manager': 'review_items:manager',
        'Fraud': 'review_items:fraud', 'Edited': 'review_items:edited',
        'Verification': 'review_items:verification', 'Email': 'review_items:email'
    };

    // --- Get all UI elements ---
    const popOutButton = document.getElementById('pop-out-button');
    const agentList = document.getElementById('agent-list');
    const resultsDiv = document.getElementById('results');
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const reviewCountsDisplay = document.getElementById('review-counts-display');

    // Agent control buttons
    const runButton = document.getElementById('run-button');
    const refreshStatsButton = document.getElementById('refresh-stats-button');
    const resetButton = document.getElementById('reset-button');
    const stopButton = document.getElementById('stop-button');

    // Queue control button
    const refreshQueuesButton = document.getElementById('refresh-queues-button');

    // Modal elements
    const permissionModal = document.getElementById('permission-modal');
    const modalAgentName = document.getElementById('modal-agent-name');
    const modalPermissionList = document.getElementById('modal-permission-list');
    const modalCloseButton = document.getElementById('modal-close-button');
    const modalCancelButton = document.getElementById('modal-cancel-button');
    const modalSaveButton = document.getElementById('modal-save-button');


    // --- Pop-out Logic ---
    if (isPoppedOut) {
        // This is a floating window, so hide the pop-out button and make body resizable
        popOutButton.style.display = 'none';
        document.body.style.width = 'auto'; // Override the 380px fixed width from CSS
    } else {
        // This is the main extension popup, add listener to create the floating window
        popOutButton.addEventListener('click', () => {
            window.close(); // Close the current popup
            chrome.windows.create({
                url: 'popup.html?isPoppedOut=true',
                type: 'popup',
                width: 400,
                height: 650
            });
        });
    }

    // Populate agent list
    Object.keys(agents).sort().forEach(name => {
        const label = document.createElement('label');
        label.className = 'flex items-center space-x-3 p-1.5 rounded-md hover:bg-gray-700 cursor-pointer';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = name;
        checkbox.value = name;
        checkbox.className = 'h-4 w-4 text-blue-500 bg-gray-600 border-gray-500 rounded focus:ring-blue-500 focus:ring-offset-gray-800 focus:ring-2 ui-checkbox';
        const span = document.createElement('span');
        span.textContent = name;
        span.className = 'block text-sm text-gray-300';
        label.appendChild(checkbox);
        label.appendChild(span);
        agentList.appendChild(label);
    });

    // Load saved state from storage and initialize UI
    chrome.storage.local.get(['selectedAgents', 'agentData', 'isRunning', 'reviewCounts'], (result) => {
        // Populate agent selection checkboxes
        if (result.selectedAgents) {
            result.selectedAgents.forEach(name => {
                const checkbox = document.getElementById(name);
                if (checkbox) checkbox.checked = true;
            });
        }
        
        // Set UI state for controls
        updateRunningState(result.isRunning || false);
        
        // Populate agent results div
        if (result.isRunning) {
            if (result.agentData && Object.keys(result.agentData).length > 0) {
                updateResults(result.agentData);
            } else {
                resultsDiv.innerHTML = '<p class="text-center text-gray-500 py-4"><i class="fas fa-spinner fa-spin"></i> Loading agent data...</p>';
            }
        }
        
        // Populate queue counts div
        if (result.reviewCounts) {
            updateReviewCountsDisplay(result.reviewCounts);
        } else {
            chrome.runtime.sendMessage({ action: 'refreshNow' });
        }
    });

    // --- Event Listeners ---

    // Queue Section Listener
    refreshQueuesButton.addEventListener('click', () => {
        refreshQueuesButton.disabled = true;
        refreshQueuesButton.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 0.25rem;"></i>...';
        chrome.runtime.sendMessage({ action: 'refreshNow' });
    });

    // Agent Section Listeners
    runButton.addEventListener('click', () => {
        const selectedCheckboxes = agentList.querySelectorAll('input:checked');
        const selectedAgents = Array.from(selectedCheckboxes).map(cb => cb.id);

        if (selectedAgents.length === 0) {
            alert('Please select at least one agent to start tracking.');
            return;
        }

        chrome.storage.local.set({ selectedAgents, isRunning: true }, () => {
            chrome.runtime.sendMessage({ action: 'startTracking' });
        });
    });
    
    refreshStatsButton.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'refreshAgentStats' });
    });

    resetButton.addEventListener('click', () => {
        if (confirm("Are you sure you want to reset all agent tracking statistics? This cannot be undone.")) {
            chrome.runtime.sendMessage({ action: 'resetStats' });
        }
    });

    stopButton.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'stopTracking' });
    });

    // Listen for data changes from the background script
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (changes.agentData) {
            updateResults(changes.agentData.newValue);
        }
        if(changes.reviewCounts) {
            updateReviewCountsDisplay(changes.reviewCounts.newValue);
        }
        if (changes.isRunning) {
            updateRunningState(changes.isRunning.newValue || false);
        }
    });
    
    // --- Modal and Permissions Listeners ---
    resultsDiv.addEventListener('click', (e) => {
        if (e.target.matches('.edit-permissions-btn')) {
            e.stopPropagation(); 
            const agentName = e.target.dataset.agentName;
            showPermissionEditor(agentName);
        }
    });

    modalCloseButton.addEventListener('click', () => permissionModal.classList.remove('is-active'));
    modalCancelButton.addEventListener('click', () => permissionModal.classList.remove('is-active'));

    modalSaveButton.addEventListener('click', () => {
        const agentName = modalSaveButton.dataset.agentName;
        const checkboxes = modalPermissionList.querySelectorAll('input[type="checkbox"]');
        const newPermissions = {};
        checkboxes.forEach(cb => {
            newPermissions[cb.value] = cb.checked;
        });

        chrome.runtime.sendMessage({ action: 'updatePermissions', agentName, permissions: newPermissions }, (response) => {
            if (response.status === 'success') {
                permissionModal.classList.remove('is-active');
            } else {
                alert(`Error updating permissions: ${response.error}`);
            }
        });
    });


    // --- Core UI Functions ---

    // Manages state of agent-related controls and status indicator
    function updateRunningState(isRunning) {
        runButton.disabled = isRunning;
        refreshStatsButton.disabled = !isRunning;
        resetButton.disabled = !isRunning;
        stopButton.disabled = !isRunning;

        if (isRunning) {
            statusIndicator.classList.replace('bg-gray-500', 'bg-green-500');
            statusText.textContent = "Active";
            statusText.classList.replace('text-gray-400', 'text-green-400');
        } else {
            statusIndicator.classList.replace('bg-green-500', 'bg-gray-500');
            statusText.textContent = "Inactive";
            statusText.classList.replace('text-green-400', 'text-gray-400');
            resultsDiv.innerHTML = '<p class="text-center text-gray-500 py-4">Agent tracking is stopped.</p>';
        }
    }

    // Manages the independent queue display
    function updateReviewCountsDisplay(counts) {
        refreshQueuesButton.disabled = false;
        refreshQueuesButton.innerHTML = '<i class="fas fa-sync-alt" style="margin-right: 0.25rem;"></i>Refresh';

        if (!counts || Object.keys(counts).length === 0) {
            reviewCountsDisplay.innerHTML = '<p class="text-center text-gray-500 col-span-4">Could not load review counts.</p>';
            return;
        }

        reviewCountsDisplay.innerHTML = ''; // Clear previous
        
        const queueOrder = ['member', 'listing_fee', 'general', 'edited', 'manager', 'fraud', 'verification', 'email'];
        const queueMap = {
            'member': 'M', 'listing_fee': 'L', 'general': 'G', 'edited': 'E',
            'manager': 'Mgr', 'fraud': 'F', 'verification': 'V', 'email': 'Mail'
        };

        queueOrder.forEach(key => {
            if (counts.hasOwnProperty(key)) {
                const value = counts[key];
                const shortName = queueMap[key] || '?';
                const item = document.createElement('div');
                item.className = "font-mono text-sm";
                item.innerHTML = `
                    <div class="text-xs text-gray-400 font-medium">${shortName}</div>
                    <div class="font-bold text-lg ${value > 100 ? 'text-red-400' : 'text-blue-400'}">${value}</div>
                `;
                reviewCountsDisplay.appendChild(item);
            }
        });
    }

    // Manages the agent results display
    function updateResults(data) {
        if (!data || Object.keys(data).length === 0) {
             chrome.storage.local.get('isRunning', result => {
                if(result.isRunning) {
                    resultsDiv.innerHTML = '<p class="text-center text-gray-500 py-4"><i class="fas fa-spinner fa-spin"></i> Loading agent data...</p>';
                } else {
                     resultsDiv.innerHTML = '<p class="text-center text-gray-500 py-4">Select agents and click Start.</p>';
                }
             });
            return;
        }
        resultsDiv.innerHTML = ''; // Clear previous results

        const sortedAgents = Object.keys(data).sort();

        for (const name of sortedAgents) {
            const agentInfo = data[name];
            const card = document.createElement('div');
            card.className = 'bg-gray-800 p-3 rounded-lg';
            
            const thisHourAds = agentInfo.thisHourAds || 0;
            const lastHourAds = agentInfo.lastHourAds || 0;
            const totalSinceStart = agentInfo.cumulativeNewAds || 0;
            
            card.innerHTML = `
                <div class="flex justify-between items-center mb-1">
                    <span class="font-semibold text-base text-white">${name}</span>
                    <span class="text-xs font-mono text-gray-400">Total: ${agentInfo.totalAds || 'N/A'}</span>
                </div>
                <div class="flex justify-between items-center text-sm text-purple-400 font-semibold font-mono mb-2 tracking-widest">
                    <span>${agentInfo.permissions || '...'}</span>
                    <i class="fas fa-edit edit-permissions-btn cursor-pointer p-1 hover:text-white" data-agent-name="${name}" title="Edit Permissions" style="margin-right:0;"></i>
                </div>
                <div class="grid grid-cols-3 gap-2 text-center">
                    <div>
                        <div class="text-2xl font-bold text-blue-400">${thisHourAds}</div>
                        <div class="text-xs text-gray-400 font-medium">THIS HOUR</div>
                    </div>
                    <div>
                        <div class="text-2xl font-bold text-purple-400">${lastHourAds}</div>
                        <div class="text-xs text-gray-400 font-medium">LAST HOUR</div>
                    </div>
                    <div>
                        <div class="text-2xl font-bold text-green-400">${totalSinceStart}</div>
                        <div class="text-xs text-gray-400 font-medium">TOTAL</div>
                    </div>
                </div>
            `;
            resultsDiv.appendChild(card);
        }
    }

    function showPermissionEditor(agentName) {
        modalAgentName.textContent = agentName;
        modalPermissionList.innerHTML = '<div class="flex items-center justify-center p-4"><i class="fas fa-spinner fa-spin mr-2"></i>Loading current permissions...</div>';
        permissionModal.classList.add('is-active');
        modalSaveButton.dataset.agentName = agentName;

        chrome.runtime.sendMessage({ action: 'getLivePermissions', agentName }, (response) => {
             if (chrome.runtime.lastError || response.error) {
                 modalPermissionList.innerHTML = `<p class="text-center text-red-400 p-4">Error: ${response?.error || chrome.runtime.lastError.message}</p>`;
                 modalSaveButton.disabled = true;
                 return;
             }

            modalPermissionList.innerHTML = '';
            modalSaveButton.disabled = false;
            const livePermissions = response.permissions;

            Object.entries(ALL_PERMISSIONS_MAP).forEach(([permissionName, permissionValue]) => {
                 const isChecked = livePermissions.includes(permissionName);
                 const label = document.createElement('label');
                 label.className = 'flex items-center space-x-3 p-1.5 rounded-md hover:bg-gray-700 cursor-pointer';
                 const checkbox = document.createElement('input');
                 checkbox.type = 'checkbox';
                 checkbox.value = permissionValue;
                 checkbox.checked = isChecked;
                 checkbox.className = 'h-4 w-4 text-blue-500 bg-gray-600 border-gray-500 rounded focus:ring-blue-500 focus:ring-offset-gray-800 focus:ring-2 ui-checkbox';
                 const span = document.createElement('span');
                 span.textContent = permissionName;
                 span.className = 'block text-sm text-gray-300';
                 label.appendChild(checkbox);
                 label.appendChild(span);
                 modalPermissionList.appendChild(label);
            });
        });
    }
});