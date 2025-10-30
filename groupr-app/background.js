chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  try {
    switch (msg.action) {
      case 'organizeTabs':
        if (msg.groups?.length) {



          //  tab organizing code here
          // ...
          





           // Get all tabs in the current window
      const tabs = await chrome.tabs.query({ currentWindow: true });

      // Create a map: groupName => tabIds array
      const tabGroups = {};

      // Dummy logic: assign tab to first group whose name appears in tab title or URL (case insensitive)
      tabs.forEach(tab => {
        const tabContent = (tab.title + ' ' + tab.url).toLowerCase();
        const matchedGroup = msg.groups.find(g => tabContent.includes(g.name.toLowerCase()));
        const groupName = matchedGroup ? matchedGroup.name : 'Uncategorized';

        if (!tabGroups[groupName]) tabGroups[groupName] = [];
        tabGroups[groupName].push(tab.id);
      });

      // Now create groups and move tabs into them
      for (const [groupName, tabIds] of Object.entries(tabGroups)) {
        if (groupName === 'Uncategorized') continue; // Skip uncategorized for now
        const groupId = await chrome.tabs.group({ tabIds });
        await chrome.tabGroups.update(groupId, { title: groupName });
      }

      }

      // Respond success whether or not any groups were processed
      sendResponse({ success: true });
      break;
    case 'ungroupTabs':
      // Your ungrouping code here
      // ...
        sendResponse({ success: true });
        break;
      case 'deleteGroup':
        // Your delete group code here
        // ...
        sendResponse({ success: true });
        break;
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch(error) {
    console.error('Error in onMessage listener:', error);
    sendResponse({ success: false, error: error.message });
  }
  return true; // Keep message channel open for async
});
