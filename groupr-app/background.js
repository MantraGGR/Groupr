// OAuth helper: obtain an interactive access token using chrome.identity
async function getAccessTokenInteractive() {
  return new Promise((resolve, reject) => {
    try {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        const err = chrome.runtime.lastError;
        if (err) return reject(err);
        resolve(token);
      });
    } catch (e) {
      reject(e);
    }
  });
}

// Call Gemini (Generative Language) API with the access token
async function callGemini(prompt) {
  const token = await getAccessTokenInteractive();
  const url = 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent';

  const body = {
    // Adapt the request shape to the API; this is a basic example
    prompt: { text: prompt }
  }; 


  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error('Gemini API error: ' + txt); 
  }
  return resp.json();
}

// Call the development/production backend to run the model. Backend will verify the user and proxy the request.
async function callServerGenerate(prompt) {
  // Use local server for dev; in production this should be your deployed backend URL
  const base = 'http://localhost:8080';
  const token = await getAccessTokenInteractive();
  const resp = await fetch(`${base}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ prompt })
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error('Server generate error: ' + txt);
  }
  // server forwards raw response from Gemini; try to parse as json
  const ct = resp.headers.get('content-type') || '';
  if (ct.includes('application/json')) return resp.json();
  const txt = await resp.text();
  try { return JSON.parse(txt); } catch (e) { return txt; }
}

// Ask backend if the current user is authorized
async function checkAuthorization() {
  const base = 'http://localhost:8080';
  const token = await getAccessTokenInteractive();
  const resp = await fetch(`${base}/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: token })
  });
  if (!resp.ok) return false;
  const body = await resp.json();
  return !!body.authorized;
}

// Try to extract plain text from various possible Gemini response shapes
function extractTextFromLLMResponse(resp) {
  if (!resp) return null;
  // Common shapes: { candidates: [{ content: "..." }] } or { output: [{ content: [{ text: "..." }] }] }
  try {
    if (typeof resp === 'string') return resp;
    if (resp.candidates && resp.candidates.length) {
      const c = resp.candidates[0];
      if (typeof c === 'string') return c;
      if (c.content) return typeof c.content === 'string' ? c.content : JSON.stringify(c.content);
    }
    if (resp.output && resp.output.length) {
      const o = resp.output[0];
      if (o.content && Array.isArray(o.content)) {
        // join text pieces
        return o.content.map(p => p.text || JSON.stringify(p)).join('\n');
      }
      if (o.content && typeof o.content === 'string') return o.content;
    }
    // Some responses may have `text` or `result`
    if (resp.text) return resp.text;
    if (resp.result) return typeof resp.result === 'string' ? resp.result : JSON.stringify(resp.result);
    return JSON.stringify(resp);
  } catch (e) {
    console.error('extractTextFromLLMResponse failed', e, resp);
    return null;
  }
}

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  try {
    switch (msg.action) {
      case 'organizeTabs':
        if (msg.groups?.length) {



          //  tab organizing code here
          // ...
          





           // Get all tabs in the current window
      const tabs = await chrome.tabs.query({ currentWindow: true });

      // Attempt to let the LLM assign tabs to groups.
      // We provide numeric tab IDs in the prompt and instruct the model to output strict JSON:
      // { "assignments": [ { "tabId": 123, "group": "Work" }, ... ] }
      const tabGroups = {};

      const desiredGroupNames = msg.groups.map(g => g.name);
      const tabsList = tabs.map(t => `ID:${t.id}\nTitle: ${t.title}\nURL: ${t.url}`).join('\n\n');

      const prompt = `You are a helpful assistant. Here are ${tabs.length} browser tabs (each has a numeric ID).\n\n${tabsList}\n\n` +
        `The user has these desired groups: ${JSON.stringify(desiredGroupNames)}. ` +
        `Assign each tab to one of the desired groups. If none fit, you may suggest a new group name. ` +
        `Output ONLY valid JSON and nothing else in this exact shape: {"assignments":[{"tabId": <number>, "group": "<group name>"}, ...]}. ` +
        `Use the numeric ID values shown above for tabId so we can match them programmatically.`;

      let llmRespText = null;
      try {
        const allowed = await checkAuthorization();
        if (!allowed) throw new Error('user not authorized');
        const llmResp = await callServerGenerate(prompt);
        llmRespText = extractTextFromLLMResponse(llmResp);
      } catch (err) {
        console.error('LLM/server call failed or unauthorized, falling back to simple heuristic:', err);
      }

      let assignments = null;
      if (llmRespText) {
        // Try to extract JSON from the model text. Some models wrap code blocks; try to find a JSON substring.
        try {
          // Find first { and last } to try to isolate JSON
          const first = llmRespText.indexOf('{');
          const last = llmRespText.lastIndexOf('}');
          const jsonCandidate = first !== -1 && last !== -1 ? llmRespText.slice(first, last + 1) : llmRespText;
          const parsed = JSON.parse(jsonCandidate);
          if (parsed && Array.isArray(parsed.assignments)) assignments = parsed.assignments;
        } catch (e) {
          console.error('Failed to parse LLM JSON response, will fallback to title/URL heuristic', e, llmRespText);
        }
      }

      if (!assignments) {
        // Fallback heuristic: assign by checking if group name appears in tab title or url
        for (const tab of tabs) {
          const tabContent = (tab.title + ' ' + tab.url).toLowerCase();
          const matchedGroup = msg.groups.find(g => tabContent.includes(g.name.toLowerCase()));
          const groupName = matchedGroup ? matchedGroup.name : 'Uncategorized';
          if (!tabGroups[groupName]) tabGroups[groupName] = [];
          tabGroups[groupName].push(tab.id);
        }
      } else {
        // Build tabGroups from the assignments
        for (const a of assignments) {
          // Ensure tabId is numeric
          const tabId = Number(a.tabId);
          const groupName = a.group || 'Uncategorized';
          if (!tabGroups[groupName]) tabGroups[groupName] = [];
          // Only include tab if it exists in current window
          if (tabs.find(t => t.id === tabId)) tabGroups[groupName].push(tabId);
        }
      }

      // Now create groups and move tabs into them
      for (const [groupName, tabIds] of Object.entries(tabGroups)) {
        if (groupName === 'Uncategorized') continue; // Skip uncategorized for now
        try {
          const groupId = await chrome.tabs.group({ tabIds });
          await chrome.tabGroups.update(groupId, { title: groupName });
        } catch (e) {
          console.error('Failed to create/update group', groupName, e);
        }
      }

      }

      // Respond success whether or not any groups were processed
      sendResponse({ success: true });
      break;
    case 'testLLM':
      try {
        const allowed = await checkAuthorization();
        if (!allowed) return sendResponse({ success: false, error: 'not_authorized' });
        const resp = await callServerGenerate(msg.prompt || 'Say hello briefly');
        const txt = extractTextFromLLMResponse(resp) || JSON.stringify(resp);
        sendResponse({ success: true, result: txt });
      } catch (e) {
        console.error('testLLM failed', e);
        sendResponse({ success: false, error: e.message });
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
