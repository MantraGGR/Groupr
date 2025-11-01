// ========== AUTH & TOKEN MANAGEMENT ==========

async function getAuthToken(interactive = true) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      const err = chrome.runtime.lastError;
      if (err) return reject(err);
      if (!token) return reject(new Error('No token received'));
      resolve(token);
    });
  });
}

async function refreshAuthToken() {
  try {
    const oldToken = await getAuthToken(false);
    if (oldToken) {
      await new Promise(resolve => {
        chrome.identity.removeCachedAuthToken({ token: oldToken }, resolve);
      });
    }
  } catch (e) {
    console.log('No cached token to remove');
  }
  return getAuthToken(true);
}

// ========== GEMINI API INTEGRATION ==========

async function callGeminiAPI(prompt, retryCount = 0) {
  const token = await getAuthToken();
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
  const body = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.3,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
    }
  };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      if (resp.status === 401 && retryCount === 0) {
        console.log('Token expired, refreshing...');
        await refreshAuthToken();
        return callGeminiAPI(prompt, retryCount + 1);
      }
      const errorText = await resp.text();
      throw new Error(`Gemini API error (${resp.status}): ${errorText}`);
    }

    return await resp.json();
  } catch (error) {
    console.error('Gemini API call failed:', error);
    throw error;
  }
}
//bruh
function extractTextFromGeminiResponse(response) {
  try {
    if (!response || !response.candidates || response.candidates.length === 0) {
      return null;
    }

    const candidate = response.candidates[0];
    if (!candidate.content || !candidate.content.parts) {
      return null;
    }

    return candidate.content.parts
      .map(part => part.text || '')
      .join('\n')
      .trim();
  } catch (error) {
    console.error('Failed to extract text from Gemini response:', error);
    return null;
  }
}

// ========== TAB GROUPING LOGIC ==========

async function organizeTabsWithAI(userGroups) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  
  // Filter out extension pages and create clean tab list
  const validTabs = tabs.filter(tab => 
    !tab.url.startsWith('chrome://') && 
    !tab.url.startsWith('chrome-extension://')
  );

  if (validTabs.length === 0) {
    throw new Error('No valid tabs to organize');
  }

  // Create detailed tab descriptions for Gemini
  const tabDescriptions = validTabs.map((tab, idx) => {
    return `[${idx}] "${tab.title}" - ${tab.url}`;
  }).join('\n');

  const groupNames = userGroups.map(g => g.name).join(', ');

  const prompt = `You are an expert at organizing browser tabs into logical groups.

AVAILABLE GROUPS: ${groupNames}

TABS TO ORGANIZE:
${tabDescriptions}

TASK: Assign each tab to the most appropriate group based on its title and URL. Consider:
- Content category (work, shopping, social media, news, etc.)
- Domain similarity
- Topic relevance

OUTPUT FORMAT: Return ONLY a valid JSON object with this exact structure:
{
  "assignments": [
    {"index": 0, "group": "group_name"},
    {"index": 1, "group": "group_name"}
  ]
}

Rules:
- Use the index numbers [0], [1], etc. shown above
- Only use group names from the available groups
- If no group fits well, assign to the closest match
- Return valid JSON only, no explanations`;

  console.log('Sending prompt to Gemini...');
  const response = await callGeminiAPI(prompt);
  const responseText = extractTextFromGeminiResponse(response);

  if (!responseText) {
    throw new Error('Empty response from Gemini');
  }

  console.log('Gemini response:', responseText);

  // Parse JSON from response (handle markdown code blocks)
  let assignments;
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? jsonMatch[0] : responseText;
    const parsed = JSON.parse(jsonText);
    assignments = parsed.assignments;

    if (!Array.isArray(assignments)) {
      throw new Error('Invalid assignments format');
    }
  } catch (error) {
    console.error('Failed to parse Gemini JSON:', error);
    throw new Error('Failed to parse AI response. Please try again.');
  }

  // Create a mapping of group name to tab IDs
  const groupMap = {};
  for (const assignment of assignments) {
    const tabIndex = assignment.index;
    const groupName = assignment.group;

    if (tabIndex >= 0 && tabIndex < validTabs.length) {
      if (!groupMap[groupName]) {
        groupMap[groupName] = [];
      }
      groupMap[groupName].push(validTabs[tabIndex].id);
    }
  }

  // Create tab groups
  let groupedCount = 0;
  const colors = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
  let colorIndex = 0;

  for (const [groupName, tabIds] of Object.entries(groupMap)) {
    if (tabIds.length === 0) continue;

    try {
      const groupId = await chrome.tabs.group({ tabIds });
      await chrome.tabGroups.update(groupId, {
        title: groupName,
        color: colors[colorIndex % colors.length]
      });
      colorIndex++;
      groupedCount += tabIds.length;
    } catch (error) {
      console.error(`Failed to create group "${groupName}":`, error);
    }
  }

  return {
    totalTabs: validTabs.length,
    groupedTabs: groupedCount,
    groups: Object.keys(groupMap).length
  };
}

async function organizeTabsSimple(userGroups) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const groupMap = {};

  // Simple keyword-based fallback
  for (const tab of tabs) {
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      continue;
    }

    const content = (tab.title + ' ' + tab.url).toLowerCase();
    let matched = false;

    for (const group of userGroups) {
      if (content.includes(group.name.toLowerCase())) {
        if (!groupMap[group.name]) groupMap[group.name] = [];
        groupMap[group.name].push(tab.id);
        matched = true;
        break;
      }
    }

    if (!matched) {
      if (!groupMap['Other']) groupMap['Other'] = [];
      groupMap['Other'].push(tab.id);
    }
  }

  // Create groups
  const colors = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
  let colorIndex = 0;

  for (const [groupName, tabIds] of Object.entries(groupMap)) {
    if (tabIds.length > 0) {
      try {
        const groupId = await chrome.tabs.group({ tabIds });
        await chrome.tabGroups.update(groupId, {
          title: groupName,
          color: colors[colorIndex % colors.length]
        });
        colorIndex++;
      } catch (error) {
        console.error(`Failed to create group "${groupName}":`, error);
      }
    }
  }
}

// ========== MESSAGE HANDLERS ==========

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.action) {
        case 'organizeTabs': {
          if (!msg.groups || msg.groups.length === 0) {
            return sendResponse({ 
              success: false, 
              error: 'Please add at least one group first' 
            });
          }

          try {
            const result = await organizeTabsWithAI(msg.groups);
            sendResponse({ 
              success: true, 
              result,
              message: `Organized ${result.groupedTabs} tabs into ${result.groups} groups`
            });
          } catch (aiError) {
            console.error('AI organization failed, using simple method:', aiError);
            await organizeTabsSimple(msg.groups);
            sendResponse({ 
              success: true,
              fallback: true,
              message: 'Tabs organized using keyword matching'
            });
          }
          break;
        }

        case 'ungroupTabs': {
          const allGroups = await chrome.tabGroups.query({});
          const targetGroup = allGroups.find(g => g.title === msg.groupName);

          if (!targetGroup) {
            return sendResponse({ 
              success: false, 
              error: 'Group not found' 
            });
          }

          const tabsInGroup = await chrome.tabs.query({ groupId: targetGroup.id });
          if (tabsInGroup.length > 0) {
            await chrome.tabs.ungroup(tabsInGroup.map(t => t.id));
          }

          sendResponse({ success: true });
          break;
        }

        case 'deleteGroup': {
          const allGroups = await chrome.tabGroups.query({});
          const targetGroup = allGroups.find(g => g.title === msg.groupName);

          if (!targetGroup) {
            return sendResponse({ 
              success: false, 
              error: 'Group not found' 
            });
          }

          const tabsInGroup = await chrome.tabs.query({ groupId: targetGroup.id });
          if (tabsInGroup.length > 0) {
            await chrome.tabs.remove(tabsInGroup.map(t => t.id));
          }

          sendResponse({ success: true });
          break;
        }

        case 'testGemini': {
          try {
            const response = await callGeminiAPI(
              msg.prompt || 'Say "Hello from Grouper!" in a friendly way'
            );
            const text = extractTextFromGeminiResponse(response);
            sendResponse({ 
              success: true, 
              result: text || 'No response text' 
            });
          } catch (error) {
            sendResponse({ 
              success: false, 
              error: error.message 
            });
          }
          break;
        }

        default:
          sendResponse({ 
            success: false, 
            error: 'Unknown action' 
          });
      }
    } catch (error) {
      console.error('Error in message handler:', error);
      sendResponse({ 
        success: false, 
        error: error.message || 'An unexpected error occurred' 
      });
    }
  })();

  return true; // Keep channel open for async response
});

console.log('Groupr background service worker loaded');