// Store tab URLs and their domains
let tabData = {};
let isEnabled = false;
let isShuttingDown = false;

// Handle browser startup
chrome.runtime.onStartup.addListener(async () => {
  tabData = {}; // Reset on browser startup
  await initializeState();
});

// Initialize extension state
async function initializeState() {
  try {
    const state = await chrome.storage.local.get('enabled');
    isEnabled = state.enabled ?? false;
    console.log('Extension initialized, enabled:', isEnabled);
  } catch (error) {
    console.error('Failed to initialize extension:', error);
    isEnabled = false;
  }
}

// Initialize state immediately
initializeState().catch(error => {
  console.error('Failed to initialize:', error);
});

// Listen for toggle state changes
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'toggleStateChanged') {
    isEnabled = message.enabled;
    if (!isEnabled) {
      // Clear all stored tab data when extension is disabled
      tabData = {};
    }
  }
});

// Listen for tab focus changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (!isEnabled) return;
  
  const previousTabs = Object.keys(tabData).filter(id => id != activeInfo.tabId);
  for (const tabId of previousTabs) {
    const tabInfo = tabData[tabId];
    if (tabInfo && tabInfo.domain) {
      await deleteCookiesForDomain(tabInfo.domain);
    }
  }
});

// Helper function to get domain from URL
function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    console.error('Invalid URL:', url);
    return null;
  }
}

// Helper function to check if URL is valid
function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

// Helper function to delete cookies for a domain
async function deleteCookiesForDomain(domain) {
  if (!domain || !isEnabled || isShuttingDown) return;
  
  try {
    // Handle both exact domain and its subdomains
    const mainDomain = domain.replace(/^www\./, '');
    const cookies = await chrome.cookies.getAll({});
    
    // Filter cookies that match the domain or its subdomains
    const relevantCookies = cookies.filter(cookie => {
      if (!cookie.domain) return false;
      const cookieDomain = cookie.domain.replace(/^\./, ''); // Remove leading dot
      return cookieDomain.includes(mainDomain) || mainDomain.includes(cookieDomain);
    });

    // Delete each cookie with retry logic
    const deletePromises = relevantCookies.map(async cookie => {
      const protocol = cookie.secure ? 'https:' : 'http:';
      const cookieUrl = `${protocol}//${cookie.domain}${cookie.path}`;
      
      try {
        await chrome.cookies.remove({
          url: cookieUrl,
          name: cookie.name,
        });
      } catch (error) {
        console.warn(`Failed to delete cookie ${cookie.name} for ${cookie.domain}:`, error);
      }
    });

    await Promise.all(deletePromises);
    console.log(`Successfully deleted ${relevantCookies.length} cookies for ${domain} and subdomains`);
  } catch (error) {
    console.error(`Error deleting cookies for ${domain}:`, error);
  }
}

// Listen for tab updates and history state changes
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if ((changeInfo.url || changeInfo.status === 'complete') && tab.url && isValidUrl(tab.url)) {
    const newDomain = getDomain(tab.url);
    const oldData = tabData[tabId];
    
    // If there was a previous domain and it's different from the new one, delete its cookies
    if (oldData && oldData.domain && oldData.domain !== newDomain) {
      await deleteCookiesForDomain(oldData.domain);
    }
    
    if (newDomain) {
      tabData[tabId] = {
        url: tab.url,
        domain: newDomain,
        timestamp: Date.now()
      };
    }
  }
});

// Listen for history state changes
chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
  if (isValidUrl(details.url)) {
    const newDomain = getDomain(details.url);
    const oldData = tabData[details.tabId];
    
    if (oldData && oldData.domain && oldData.domain !== newDomain) {
      await deleteCookiesForDomain(oldData.domain);
      
      if (newDomain) {
        tabData[details.tabId] = {
          url: details.url,
          domain: newDomain,
          timestamp: Date.now()
        };
      }
    }
  }
});

// Listen for tab creation
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.url && isValidUrl(tab.url)) {
    const domain = getDomain(tab.url);
    if (domain) {
      tabData[tab.id] = {
        url: tab.url,
        domain: domain,
        timestamp: Date.now()
      };
    }
  }
});

// Listen for tab removal
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  const tabInfo = tabData[tabId];
  if (tabInfo && isEnabled && !isShuttingDown) {
    await deleteCookiesForDomain(tabInfo.domain);
    delete tabData[tabId];
  }
});

// Listen for window removal
chrome.windows.onRemoved.addListener(async (windowId) => {
  if (!isEnabled) return;
  
  // Get all tabs that were in this window
  const windowTabs = Object.entries(tabData)
    .filter(([_, data]) => data.windowId === windowId);
    
  for (const [tabId, data] of windowTabs) {
    await deleteCookiesForDomain(data.domain);
    delete tabData[tabId];
  }
});

// Handle browser shutdown
chrome.runtime.onSuspend.addListener(() => {
  isShuttingDown = true;
  // Cleanup
  tabData = {};
});

// Clean up old tab data periodically (every 30 minutes)
setInterval(() => {
  const now = Date.now();
  const thirtyMinutes = 30 * 60 * 1000;
  
  Object.entries(tabData).forEach(([tabId, data]) => {
    if (now - data.timestamp > thirtyMinutes) {
      delete tabData[tabId];
    }
  });
}, 30 * 60 * 1000); 
