document.addEventListener('DOMContentLoaded', async () => {
  const toggleSwitch = document.getElementById('toggleSwitch');
  const statusText = document.getElementById('status');
  const errorText = document.getElementById('error');
  let retryCount = 0;
  const MAX_RETRIES = 3;

  async function initializePopup() {
    try {
      // Check if background script is ready
      const response = await chrome.runtime.sendMessage({ type: 'getState' });
      if (response && typeof response.enabled !== 'undefined') {
        toggleSwitch.checked = response.enabled;
      } else {
        // Fallback to storage if background isn't ready
        const state = await chrome.storage.local.get('enabled');
        toggleSwitch.checked = state.enabled ?? false;
      }
      updateStatus(toggleSwitch.checked);
      hideError();
    } catch (error) {
      console.error('Error initializing popup:', error);
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        setTimeout(initializePopup, 1000); // Retry after 1 second
      } else {
        showError('Failed to initialize extension');
      }
    }
  }

  // Initialize popup
  await initializePopup();

  // Handle toggle changes
  const handleChange = async (e) => {
    const isEnabled = e.target.checked;
    toggleSwitch.disabled = true; // Prevent multiple clicks

    try {
      // Update storage first
      await chrome.storage.local.set({ enabled: isEnabled });
      
      // Notify background script
      await chrome.runtime.sendMessage({ 
        type: 'toggleStateChanged', 
        enabled: isEnabled,
        timestamp: Date.now()
      });

      updateStatus(isEnabled);
      hideError();
    } catch (error) {
      console.error('Error updating state:', error);
      showError('Failed to update extension state');
      // Revert the toggle
      e.target.checked = !isEnabled;
      updateStatus(!isEnabled);
    } finally {
      toggleSwitch.disabled = false;
    }
  };

  toggleSwitch.addEventListener('change', handleChange);

  // Cleanup on popup close
  window.addEventListener('unload', () => {
    toggleSwitch.removeEventListener('change', handleChange);
  });

  function updateStatus(isEnabled) {
    statusText.textContent = isEnabled ? 'Cookie cleaning enabled' : 'Cookie cleaning disabled';
    statusText.style.color = isEnabled ? '#2196F3' : '#666';
    toggleSwitch.setAttribute('aria-checked', isEnabled.toString());
    toggleSwitch.setAttribute('aria-label', `Toggle cookie cleaning: currently ${isEnabled ? 'enabled' : 'disabled'}`);
  }

  function showError(message) {
    errorText.textContent = message;
    errorText.style.display = 'block';
    errorText.setAttribute('role', 'alert');
  }

  function hideError() {
    errorText.style.display = 'none';
    errorText.textContent = '';
    errorText.removeAttribute('role');
  }

  // Add connection error listener
  chrome.runtime.onConnect.addListener((port) => {
    port.onDisconnect.addListener(() => {
      if (chrome.runtime.lastError) {
        showError('Lost connection to extension');
      }
    });
  });
}); 
