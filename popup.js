document.addEventListener('DOMContentLoaded', async () => {
  const toggleSwitch = document.getElementById('toggleSwitch');
  const statusText = document.getElementById('status');
  const errorText = document.getElementById('error');

  try {
    // Load initial state
    const state = await chrome.storage.local.get('enabled');
    toggleSwitch.checked = state.enabled ?? false;
    updateStatus(toggleSwitch.checked);
  } catch (error) {
    showError('Failed to load extension state');
    console.error('Error loading state:', error);
  }

  // Handle toggle changes
  const handleChange = async (e) => {
    try {
      const isEnabled = e.target.checked;
      await chrome.storage.local.set({ enabled: isEnabled });
      updateStatus(isEnabled);
      
      // Notify background script
      await chrome.runtime.sendMessage({ type: 'toggleStateChanged', enabled: isEnabled });
      hideError();
    } catch (error) {
      showError('Failed to update extension state');
      console.error('Error updating state:', error);
      // Revert the toggle if there was an error
      e.target.checked = !e.target.checked;
      updateStatus(!e.target.checked);
    }
  };

  toggleSwitch.addEventListener('change', handleChange);

  // Cleanup on popup close
  window.addEventListener('unload', () => {
    toggleSwitch.removeEventListener('change', handleChange);
  });

  function updateStatus(isEnabled) {
    statusText.textContent = isEnabled ? 'Currently enabled' : 'Currently disabled';
    statusText.style.color = isEnabled ? '#2196F3' : '#666';
  }

  function showError(message) {
    errorText.textContent = message;
    errorText.style.display = 'block';
  }

  function hideError() {
    errorText.style.display = 'none';
    errorText.textContent = '';
  }
}); 