/**
 * Snippet Library Browser Extension - Popup Script
 * Handles saving selected/pasted code to the Flask server.
 */

const statusEl = document.getElementById('serverStatus');
const serverUrlInput = document.getElementById('serverUrl');

// Load saved server URL
chrome.storage.local.get(['serverUrl'], (data) => {
    if (data.serverUrl) serverUrlInput.value = data.serverUrl;
    checkServer();
});

serverUrlInput.addEventListener('change', () => {
    chrome.storage.local.set({ serverUrl: serverUrlInput.value });
    checkServer();
});

// Check if the Flask server is reachable
async function checkServer() {
    const url = serverUrlInput.value.replace(/\/$/, '');
    try {
        const resp = await fetch(`${url}/api/projects`, { method: 'GET', credentials: 'include' });
        if (resp.ok || resp.status === 401) {
            statusEl.className = 'status connected';
            statusEl.textContent = resp.status === 401 ? '⚠️ Server online — please log in first' : '✅ Server connected';
        } else {
            throw new Error();
        }
    } catch {
        statusEl.className = 'status disconnected';
        statusEl.textContent = '❌ Server offline — start Flask app';
    }
}

// Save snippet to server
async function saveSnippet() {
    const title = document.getElementById('snippetTitle').value.trim();
    const lang = document.getElementById('snippetLang').value;
    const code = document.getElementById('snippetCode').value;
    const url = serverUrlInput.value.replace(/\/$/, '');
    const msg = document.getElementById('resultMsg');

    if (!title || !code) {
        msg.className = 'msg error';
        msg.textContent = 'Title and code are required.';
        return;
    }

    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const resp = await fetch(`${url}/api/snippets`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, language: lang, code_content: code, tags: 'browser-extension' })
        });

        if (!resp.ok) {
            const err = await resp.json();
            throw new Error(err.error || 'Failed to save');
        }

        msg.className = 'msg success';
        msg.textContent = '✅ Snippet saved to your library!';
        btn.textContent = 'Saved!';
        setTimeout(() => { btn.disabled = false; btn.textContent = 'Save to Library'; }, 2000);
    } catch (e) {
        msg.className = 'msg error';
        msg.textContent = 'Error: ' + e.message;
        btn.disabled = false;
        btn.textContent = 'Save to Library';
    }
}

// Receive selected code from content script
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SELECTED_CODE') {
        document.getElementById('snippetCode').value = msg.code;
        document.getElementById('snippetTitle').value = msg.title || 'Selected code';
        // Auto-detect language from the page
        if (msg.language) document.getElementById('snippetLang').value = msg.language;
    }
});

// Request selected code from active tab when popup opens
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_SELECTION' }).catch(() => {});
    }
});
