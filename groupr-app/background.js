chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  try {
    switch (msg.action) {
      case 'organizeTabs':
        if (msg.groups?.length) {



          // Your tab organizing code here
          // ...
          try {
            const tabs = await.chrome.tabs.query({currentWindow: true}); 
            const tabgroups = {};
            

          }





          sendResponse({ success: true });
        }
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
