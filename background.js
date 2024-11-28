// Store tab URLs and their domains
let tabData = {};
let isEnabled = false;

// Initialize extension state
async function initializeState() {
  const state = await chrome.storage.local.get('enabled');
  isEnabled = state.enabled ?? false;
}

// Initialize state immediately
initializeState();

// Listen for toggle state changes
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'toggleStateChanged') {
    isEnabled = message.enabled;
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
  if (!domain || !isEnabled) return;
  
  try {
    // Get all cookies for the domain
    const cookies = await chrome.cookies.getAll({ domain });

    // Delete each cookie
    const deletePromises = cookies.map(cookie => {
      const protocol = cookie.secure ? 'https:' : 'http:';
      const cookieUrl = `${protocol}//${cookie.domain}${cookie.path}`;
      
      return chrome.cookies.remove({
        url: cookieUrl,
        name: cookie.name,
      });
    });

    await Promise.all(deletePromises);
    console.log(`Successfully deleted ${cookies.length} cookies for ${domain}`);
  } catch (error) {
    console.error(`Error deleting cookies for ${domain}:`, error);
  }
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url && isValidUrl(changeInfo.url)) {
    const newDomain = getDomain(changeInfo.url);
    const oldData = tabData[tabId];
    
    // If there was a previous domain and it's different from the new one, delete its cookies
    if (oldData && oldData.domain && oldData.domain !== newDomain) {
      await deleteCookiesForDomain(oldData.domain);
    }
    
    if (newDomain) {
      tabData[tabId] = {
        url: changeInfo.url,
        domain: newDomain,
        timestamp: Date.now()
      };
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
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const tabInfo = tabData[tabId];
  if (tabInfo && isEnabled) {
    await deleteCookiesForDomain(tabInfo.domain);
    delete tabData[tabId];
  }
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
