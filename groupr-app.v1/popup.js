// State management
let groups = [];

// DOM elements
const groupList = document.getElementById('groupList');
const newGroupNameInput = document.getElementById('newGroupName');
const addGroupBtn = document.getElementById('addGroupBtn');
const organizeTabsBtn = document.getElementById('organizeTabsBtn');
const testGeminiBtn = document.getElementById('testGeminiBtn');
const statusMessage = document.getElementById('statusMessage');

// ========== STORAGE FUNCTIONS ==========

async function loadGroups() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['userGroups'], (result) => {
      groups = result.userGroups || [];
      resolve();
    });
  });
}

async function saveGroups() {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ userGroups: groups }, resolve);
  });
}

// ========== UI FUNCTIONS ==========

function showStatus(message, type = 'success') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message status-${type}`;
  statusMessage.style.display = 'block';

  setTimeout(() => {
    statusMessage.style.display = 'none';
  }, 4000);
}

function renderGroups() {
  if (groups.length === 0) {
    groupList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📂</div>
        <p>No groups yet.<br>Add one above to get started!</p>
      </div>
    `;
    return;
  }

  groupList.innerHTML = '';

  groups.forEach((group) => {
    const div = document.createElement('div');
    div.className = 'group-item';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'group-name';
    nameSpan.textContent = group.name;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'group-actions';

    const ungroupBtn = document.createElement('button');
    ungroupBtn.className = 'btn-ungroup';
    ungroupBtn.textContent = 'Ungroup';
    ungroupBtn.onclick = () => ungroupTabs(group.name);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => deleteGroup(group.name);

    actionsDiv.appendChild(ungroupBtn);
    actionsDiv.appendChild(deleteBtn);

    div.appendChild(nameSpan);
    div.appendChild(actionsDiv);

    groupList.appendChild(div);
  });
}

// ========== GROUP MANAGEMENT ==========

async function addGroup() {
  const name = newGroupNameInput.value.trim();

  if (!name) {
    showStatus('Please enter a group name', 'error');
    return;
  }

  if (name.length > 30) {
    showStatus('Group name is too long (max 30 characters)', 'error');
    return;
  }

  if (groups.some(g => g.name.toLowerCase() === name.toLowerCase())) {
    showStatus('This group already exists', 'error');
    return;
  }

  groups.push({ name });
  await saveGroups();
  newGroupNameInput.value = '';
  renderGroups();
  showStatus(`Added group: ${name}`, 'success');
}

async function ungroupTabs(groupName) {
  try {
    const response = await sendMessage({ action: 'ungroupTabs', groupName });
    
    if (response.success) {
      showStatus(`Ungrouped tabs in "${groupName}"`, 'success');
    } else {
      showStatus(response.error || 'Failed to ungroup tabs', 'error');
    }
  } catch (error) {
    showStatus('Error ungrouping tabs', 'error');
  }
}

async function deleteGroup(groupName) {
  if (!confirm(`Delete "${groupName}" and close all its tabs?`)) {
    return;
  }

  try {
    const response = await sendMessage({ action: 'deleteGroup', groupName });
    
    if (response.success) {
      groups = groups.filter(g => g.name !== groupName);
      await saveGroups();
      renderGroups();
      showStatus(`Deleted group: ${groupName}`, 'success');
    } else {
      showStatus(response.error || 'Failed to delete group', 'error');
    }
  } catch (error) {
    showStatus('Error deleting group', 'error');
  }
}

// ========== TAB ORGANIZATION ==========

async function organizeTabs() {
  if (groups.length === 0) {
    showStatus('Add at least one group first!', 'warning');
    return;
  }

  organizeTabsBtn.disabled = true;
  organizeTabsBtn.textContent = '⏳ Organizing...';

  try {
    const response = await sendMessage({ action: 'organizeTabs', groups });

    if (response.success) {
      if (response.fallback) {
        showStatus(response.message || 'Tabs organized (keyword matching)', 'warning');
      } else {
        showStatus(response.message || 'Tabs organized successfully!', 'success');
      }
    } else {
      showStatus(response.error || 'Failed to organize tabs', 'error');
    }
  } catch (error) {
    showStatus('Error organizing tabs', 'error');
  } finally {
    organizeTabsBtn.disabled = false;
    organizeTabsBtn.textContent = '✨ Organize Tabs with AI';
  }
}

async function testGemini() {
  testGeminiBtn.disabled = true;
  testGeminiBtn.textContent = '⏳ Testing...';

  try {
    const response = await sendMessage({ 
      action: 'testGemini',
      prompt: 'Respond with "Groupr is working!" in a friendly way'
    });

    if (response.success) {
      alert(`✅ Gemini Connection Test\n\nResponse:\n${response.result}`);
      showStatus('Gemini connection successful', 'success');
    } else {
      alert(`❌ Gemini Connection Failed\n\nError: ${response.error}`);
      showStatus('Gemini connection failed', 'error');
    }
  } catch (error) {
    alert(`❌ Connection Error\n\n${error.message}`);
    showStatus('Connection error', 'error');
  } finally {
    testGeminiBtn.disabled = false;
    testGeminiBtn.textContent = '🧪 Test Gemini Connection';
  }
}

// ========== MESSAGING HELPER ==========

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// ========== EVENT LISTENERS ==========

addGroupBtn.addEventListener('click', addGroup);

newGroupNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addGroup();
  }
});

organizeTabsBtn.addEventListener('click', organizeTabs);
testGeminiBtn.addEventListener('click', testGemini);

// ========== INITIALIZATION ==========

(async () => {
  await loadGroups();
  renderGroups();
})();