chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.action === 'organizeTabs' && msg.groups?.length) {
    try {
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

      // Group tabs using Chrome tabs.group() and update group titles
      for (const [groupName, tabIds] of Object.entries(tabGroups)) {
        if (tabIds.length > 0) {
          const groupId = await chrome.tabs.group({ tabIds });
          // Use a default color, can be expanded to let users choose
          await chrome.tabGroups.update(groupId, { title: groupName, color: 'blue' });
        }
      }

      sendResponse({ success: true });
    } catch (error) {
      console.error('Error organizing tabs:', error);
      sendResponse({ success: false, error: error.message });
    }
    // Return true to indicate async response
    return true;
  }
});
