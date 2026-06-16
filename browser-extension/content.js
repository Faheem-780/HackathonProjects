/**
 * Snippet Library Browser Extension - Content Script
 * Captures selected code/text on any page and sends it to the popup.
 */

// Listen for requests from popup to get current selection
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_SELECTION') {
        const selection = window.getSelection()?.toString() || '';
        if (selection) {
            // Detect language from page context
            const language = detectLanguage();
            chrome.runtime.sendMessage({
                type: 'SELECTED_CODE',
                code: selection,
                title: getPageTitle(),
                language: language
            });
        }
        sendResponse({ ok: true });
    }
    return true;
});

/**
 * Attempt to detect the programming language from the current page context.
 */
function detectLanguage() {
    const url = window.location.href.toLowerCase();
    const codeEl = document.querySelector('code, pre');
    const langClass = codeEl?.className || '';

    // Check code element class for language hints
    const langPatterns = [
        { pattern: /python|\.py/, lang: 'Python' },
        { pattern: /javascript|\.js|js-/, lang: 'JavaScript' },
        { pattern: /typescript|\.ts/, lang: 'TypeScript' },
        { pattern: /java[^s]|\.java/, lang: 'Java' },
        { pattern: /csharp|c#|\.cs/, lang: 'C#' },
        { pattern: /cpp|c\+\+|\.cpp/, lang: 'C++' },
        { pattern: /golang|\.go\b/, lang: 'Go' },
        { pattern: /rust|\.rs/, lang: 'Rust' },
        { pattern: /ruby|\.rb/, lang: 'Ruby' },
        { pattern: /php|\.php/, lang: 'PHP' },
        { pattern: /swift|\.swift/, lang: 'Swift' },
        { pattern: /kotlin|\.kt/, lang: 'Kotlin' },
        { pattern: /html/, lang: 'HTML' },
        { pattern: /css/, lang: 'CSS' },
        { pattern: /sql/, lang: 'SQL' },
    ];

    // Try class attribute first
    for (const { pattern, lang } of langPatterns) {
        if (pattern.test(langClass)) return lang;
    }

    // Try URL (e.g., GitHub, StackOverflow)
    for (const { pattern, lang } of langPatterns) {
        if (pattern.test(url)) return lang;
    }

    return 'Other';
}

/**
 * Get a clean page title for snippet naming.
 */
function getPageTitle() {
    const title = document.title || window.location.hostname;
    return title.length > 60 ? title.slice(0, 60) + '...' : title;
}

// Add right-click context: highlight code block on hover
let highlightedEl = null;
document.addEventListener('dblclick', function(e) {
    const codeBlock = e.target.closest('pre, code');
    if (codeBlock) {
        // Remove previous highlight
        if (highlightedEl) highlightedEl.classList.remove('snippetlib-highlight');
        codeBlock.classList.add('snippetlib-highlight');
        highlightedEl = codeBlock;

        // Select the text
        const range = document.createRange();
        range.selectNodeContents(codeBlock);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }
});
