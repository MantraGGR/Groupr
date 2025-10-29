// Load user groups from local storage or initialize
let groups = JSON.parse(localStorage.getItem('userGroups') || '[]');

const groupList = document.getElementById('groupList');
const newGroupNameInput = document.getElementById('newGroupName');
const addGroupBtn = document.getElementById('addGroupBtn');
const organizeTabsBtn = document.getElementById('organizeTabsBtn');

// Function to show groups in the popup
function renderGroups() {
  groupList.innerHTML = '';
  groups.forEach((g, i) => {
    const div = document.createElement('div');
    div.textContent = g.name;
    groupList.appendChild(div);
  });
}

// Add new group by user input
addGroupBtn.addEventListener('click', () => {
  const name = newGroupNameInput.value.trim();
  if (name && !groups.some(g => g.name === name)) {
    groups.push({ name });
    localStorage.setItem('userGroups', JSON.stringify(groups));
    newGroupNameInput.value = '';
    renderGroups();
  }
});

// Send groups to background for tab organization
organizeTabsBtn.addEventListener('click', () => {
  if(groups.length === 0) {
    alert('Add at least one group first!');
    return;
  }
  chrome.runtime.sendMessage({ action: 'organizeTabs', groups }, (response) => {
    if(response?.success) {
      alert('Tabs organized!');
    } else {
      alert('Failed to organize tabs.');
    }
  });
});

// Initial render on popup load
renderGroups();
