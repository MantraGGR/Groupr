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

    //Ungroup Button 
    const ungroupBtn = document.createElement('button');
    ungroupBtn.textContent = 'Ungroup';
    ungroupBtn.style.marginLeft = '10px';
    ungroupBtn.style.marginRight = '10px';
    ungroupBtn.onclick = () => {

      ungroupTabs(g.name);



    }
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete Group';
    deleteBtn.onclick = () => {
      deleteGroup(g.name); 
    }

    div.appendChild(ungroupBtn);
    div.appendChild(deleteBtn);



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

function ungroupTabs(groupName) {
  chrome.runtime.sendMessage({ action: 'ungroupTabs', groupName }, (response) => {
    if(response.success) alert(`Tabs in group "${groupName}" ungrouped.`);
    else alert(`Failed to ungroup tabs in "${groupName}".`);
  });
}

function deleteGroup(groupName) {
  if(confirm(`Are you sure you want to delete the group "${groupName}" and close its tabs?`)) {
    chrome.runtime.sendMessage({ action: 'deleteGroup', groupName }, (response) => {
      if(response.success) {
        alert(`Group "${groupName}" deleted.`);
        // Remove group from local storage and re-render
        groups = groups.filter(g => g.name !== groupName);
        localStorage.setItem('userGroups', JSON.stringify(groups));
        renderGroups();
      } else {
        alert(`Failed to delete group "${groupName}".`);
      }
    });
  }
}



// Initial render on popup load
renderGroups();
