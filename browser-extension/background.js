/**
 * Snippet Library Browser Extension - Background Service Worker
 * Manages the right-click context menu for quick snippet capture.
 */

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'save-to-snippet-library',
        title: 'Save to Snippet Library',
        contexts: ['selection']
    });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'save-to-snippet-library' && info.selectionText) {
        // Open the popup with the selected code pre-filled
        chrome.action.openPopup().then(() => {
            setTimeout(() => {
                chrome.runtime.sendMessage({
                    type: 'SELECTED_CODE',
                    code: info.selectionText,
                    title: tab.title?.slice(0, 60) || 'Selected code',
                    language: 'Other'
                });
            }, 300);
        }).catch(() => {
            // Fallback: store selection for popup to pick up
            chrome.storage.local.set({
                pendingSnippet: {
                    code: info.selectionText,
                    title: tab.title?.slice(0, 60) || 'Selected code',
                    language: 'Other',
                    timestamp: Date.now()
                }
            });
        });
    }
});
