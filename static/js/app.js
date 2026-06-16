/**
 * Frontend JavaScript for the Collaborative Code Snippet Library
 * Handles: Search, Filter, CRUD operations (snippets + projects), Copy to Clipboard
 * NextGenHacks Hackathon Project
 */

// ============================================================================
// Configuration & State
// ============================================================================

const API_BASE = '/api/snippets';
const PROJECT_API = '/api/projects';
let currentEditId = null;
let editingProjectId = null;

// ============================================================================
// DOM Ready - Initialize Event Listeners
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    setupSearchListeners();
    setupCopyButtons();
    setupEditButtons();
    setupDeleteButtons();
    setupProjectButtons();
    setupShareButtons();
    setupAiButtons();
    setupVersionButtons();
    setupRunButtons();
    setupDownloadButtons();
    setupPublicButtons();
    setupCommandPalette();
    initDarkMode();
    console.log('Snippet Library initialized');
});

// ============================================================================
// Search & Filter Functionality
// ============================================================================

function setupSearchListeners() {
    const searchInput = document.getElementById('searchInput');
    const languageFilter = document.getElementById('languageFilter');
    const projectFilter = document.getElementById('projectFilter');
    const tagFilter = document.getElementById('tagFilter');

    let searchTimeout;
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(filterSnippets, 300);
    });

    languageFilter.addEventListener('change', filterSnippets);

    // Project filter dropdown
    if (projectFilter) {
        projectFilter.addEventListener('change', filterSnippets);
    }

    let tagTimeout;
    tagFilter.addEventListener('input', function() {
        clearTimeout(tagTimeout);
        tagTimeout = setTimeout(filterSnippets, 300);
    });

    tagFilter.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            clearTimeout(tagTimeout);
            filterSnippets();
        }
    });
}

/**
 * Filter snippet cards based on search, language, project, and tag.
 * All filters use AND logic — a card must match all active filters.
 */
function filterSnippets() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    const languageFilter = document.getElementById('languageFilter').value;
    const projectFilterEl = document.getElementById('projectFilter');
    const projectFilter = projectFilterEl ? projectFilterEl.value : '';
    const tagFilter = document.getElementById('tagFilter').value.toLowerCase().trim();

    const cards = document.querySelectorAll('.snippet-col');
    let visibleCount = 0;

    cards.forEach(card => {
        const title = card.querySelector('.card-title')?.textContent.toLowerCase() || '';
        const description = card.querySelector('.card-text')?.textContent.toLowerCase() || '';
        const language = card.dataset.language || '';
        const tags = (card.dataset.tags || '').toLowerCase();
        const cardProjectId = card.dataset.projectId || '';

        const matchesSearch = !searchTerm ||
            title.includes(searchTerm) ||
            description.includes(searchTerm) ||
            tags.includes(searchTerm) ||
            language.toLowerCase().includes(searchTerm);

        const matchesLanguage = !languageFilter || language === languageFilter;

        const matchesProject = !projectFilter ||
            (projectFilter === 'none' && !cardProjectId) ||
            (projectFilter !== 'none' && cardProjectId === projectFilter);

        const matchesTag = !tagFilter || tags.split(',').some(t => t.trim().includes(tagFilter));

        if (matchesSearch && matchesLanguage && matchesProject && matchesTag) {
            card.style.display = '';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    // Update count badge
    document.getElementById('snippetCount').textContent = visibleCount;

    // Show/hide "no results" message
    const noResults = document.getElementById('noResults');
    if (noResults) {
        if (visibleCount === 0 && cards.length > 0) {
            noResults.classList.remove('d-none');
        } else {
            noResults.classList.add('d-none');
        }
    }

    updateActiveFilters(searchTerm, languageFilter, projectFilter, tagFilter);
}

function updateActiveFilters(search, language, project, tag) {
    const container = document.getElementById('activeFilters');
    const badges = document.getElementById('filterBadges');
    if (!container || !badges) return;

    let html = '';
    const projectFilterEl = document.getElementById('projectFilter');
    const projectName = projectFilterEl && project ?
        projectFilterEl.options[projectFilterEl.selectedIndex]?.text : '';

    if (search) {
        html += `<span class="badge bg-info text-dark me-1"><i class="bi bi-search"></i> "${search}" <button type="button" class="btn-close btn-close-sm ms-1" style="font-size:0.5em" onclick="clearFilter('search')"></button></span>`;
    }
    if (language) {
        html += `<span class="badge bg-primary me-1"><i class="bi bi-code-slash"></i> ${language} <button type="button" class="btn-close btn-close-white btn-close-sm ms-1" style="font-size:0.5em" onclick="clearFilter('language')"></button></span>`;
    }
    if (project) {
        html += `<span class="badge bg-success me-1"><i class="bi bi-folder"></i> ${projectName} <button type="button" class="btn-close btn-close-white btn-close-sm ms-1" style="font-size:0.5em" onclick="clearFilter('project')"></button></span>`;
    }
    if (tag) {
        html += `<span class="badge bg-warning text-dark me-1"><i class="bi bi-tag"></i> ${tag} <button type="button" class="btn-close btn-close-sm ms-1" style="font-size:0.5em" onclick="clearFilter('tag')"></button></span>`;
    }

    badges.innerHTML = html;
    container.classList.toggle('d-none', !html);
}

function clearFilter(type) {
    switch (type) {
        case 'search': document.getElementById('searchInput').value = ''; break;
        case 'language': document.getElementById('languageFilter').value = ''; break;
        case 'project': document.getElementById('projectFilter').value = ''; break;
        case 'tag': document.getElementById('tagFilter').value = ''; break;
    }
    filterSnippets();
}

function clearAllFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('languageFilter').value = '';
    const pf = document.getElementById('projectFilter');
    if (pf) pf.value = '';
    document.getElementById('tagFilter').value = '';
    filterSnippets();
}

function filterByTag(tag) {
    document.getElementById('tagFilter').value = tag;
    filterSnippets();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================================
// Copy to Clipboard
// ============================================================================

function setupCopyButtons() {
    document.querySelectorAll('.copy-btn').forEach(button => {
        button.addEventListener('click', function() {
            copySnippetCode(this.dataset.snippetId, this);
        });
    });
}

async function copySnippetCode(snippetId, button) {
    try {
        const response = await fetch(`${API_BASE}/${snippetId}`);
        if (!response.ok) throw new Error('Failed to fetch snippet');
        const snippet = await response.json();
        await navigator.clipboard.writeText(snippet.code_content);

        const originalIcon = button.innerHTML;
        button.innerHTML = '<i class="bi bi-check-lg"></i>';
        button.classList.add('copied');
        showToast('Code copied to clipboard!', 'success');

        setTimeout(() => {
            button.innerHTML = originalIcon;
            button.classList.remove('copied');
        }, 2000);
    } catch (error) {
        console.error('Copy error:', error);
        showToast('Failed to copy code.', 'danger');
    }
}

// ============================================================================
// Snippet CRUD - Create
// ============================================================================

async function addSnippet() {
    const title = document.getElementById('addTitle').value.trim();
    const description = document.getElementById('addDescription').value.trim();
    const language = document.getElementById('addLanguage').value;
    const project = document.getElementById('addProject').value;
    const tags = document.getElementById('addTags').value.trim();
    const codeContent = document.getElementById('addCode').value;

    if (!title || !language || !codeContent) {
        showToast('Please fill in all required fields.', 'warning');
        return;
    }

    try {
        const body = { title, description, code_content: codeContent, language, tags };
        if (project) body.project_id = project;

        const response = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create snippet');
        }

        bootstrap.Modal.getInstance(document.getElementById('addSnippetModal')).hide();
        showToast('Snippet created successfully!', 'success');
        setTimeout(() => location.reload(), 1000);
    } catch (error) {
        console.error('Create error:', error);
        showToast(error.message, 'danger');
    }
}

// ============================================================================
// Snippet CRUD - Edit
// ============================================================================

function setupEditButtons() {
    document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', function() {
            loadSnippetForEdit(this.dataset.snippetId);
        });
    });
}

async function loadSnippetForEdit(snippetId) {
    try {
        const response = await fetch(`${API_BASE}/${snippetId}`);
        if (!response.ok) throw new Error('Failed to fetch snippet');
        const snippet = await response.json();

        document.getElementById('editId').value = snippet.id;
        document.getElementById('editTitle').value = snippet.title;
        document.getElementById('editDescription').value = snippet.description || '';
        document.getElementById('editLanguage').value = snippet.language;
        document.getElementById('editTags').value = snippet.tags.join(', ');
        document.getElementById('editCode').value = snippet.code_content;

        // Set project dropdown
        const projectSelect = document.getElementById('editProject');
        if (projectSelect) {
            projectSelect.value = snippet.project_id || '';
        }

        currentEditId = snippet.id;
    } catch (error) {
        console.error('Load error:', error);
        showToast('Failed to load snippet for editing.', 'danger');
    }
}

// ============================================================================
// Snippet CRUD - Update
// ============================================================================

async function updateSnippet() {
    if (!currentEditId) {
        showToast('No snippet selected for editing.', 'warning');
        return;
    }

    const title = document.getElementById('editTitle').value.trim();
    const description = document.getElementById('editDescription').value.trim();
    const language = document.getElementById('editLanguage').value;
    const project = document.getElementById('editProject').value;
    const tags = document.getElementById('editTags').value.trim();
    const codeContent = document.getElementById('editCode').value;

    if (!title || !language || !codeContent) {
        showToast('Please fill in all required fields.', 'warning');
        return;
    }

    try {
        const body = { title, description, code_content: codeContent, language, tags };
        body.project_id = project || null;

        const response = await fetch(`${API_BASE}/${currentEditId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update snippet');
        }

        bootstrap.Modal.getInstance(document.getElementById('editSnippetModal')).hide();
        showToast('Snippet updated successfully!', 'success');
        setTimeout(() => location.reload(), 1000);
    } catch (error) {
        console.error('Update error:', error);
        showToast(error.message, 'danger');
    }
}

// ============================================================================
// Snippet CRUD - Delete
// ============================================================================

function setupDeleteButtons() {
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', function() {
            deleteSnippet(this.dataset.snippetId);
        });
    });
}

async function deleteSnippet(snippetId) {
    if (!confirm('Are you sure you want to delete this snippet? This cannot be undone.')) return;

    try {
        const response = await fetch(`${API_BASE}/${snippetId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete snippet');
        const result = await response.json();
        showToast(result.message, 'success');
        setTimeout(() => location.reload(), 1000);
    } catch (error) {
        console.error('Delete error:', error);
        showToast(error.message, 'danger');
    }
}

// ============================================================================
// Project CRUD - Create
// ============================================================================

async function createProject() {
    const name = document.getElementById('newProjectName').value.trim();
    const description = document.getElementById('newProjectDesc').value.trim();
    const color = document.getElementById('newProjectColor').value;

    if (!name) {
        showToast('Project name is required.', 'warning');
        return;
    }

    try {
        const response = await fetch(PROJECT_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description, color })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create project');
        }

        showToast(`Project "${name}" created!`, 'success');
        setTimeout(() => location.reload(), 1000);
    } catch (error) {
        console.error('Create project error:', error);
        showToast(error.message, 'danger');
    }
}

// ============================================================================
// Project CRUD - Edit
// ============================================================================

function setupProjectButtons() {
    // Edit project buttons
    document.querySelectorAll('.edit-project-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            editingProjectId = this.dataset.projectId;
            document.getElementById('editProjectId').value = this.dataset.projectId;
            document.getElementById('editProjectName').value = this.dataset.projectName;
            document.getElementById('editProjectDescInput').value = this.dataset.projectDesc;
            document.getElementById('editProjectColor').value = this.dataset.projectColor;
            document.getElementById('editProjectForm').classList.remove('d-none');
            document.getElementById('editProjectForm').scrollIntoView({ behavior: 'smooth' });
        });
    });

    // Delete project buttons
    document.querySelectorAll('.delete-project-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            deleteProject(this.dataset.projectId);
        });
    });
}

async function updateProject() {
    const id = document.getElementById('editProjectId').value;
    const name = document.getElementById('editProjectName').value.trim();
    const description = document.getElementById('editProjectDescInput').value.trim();
    const color = document.getElementById('editProjectColor').value;

    if (!name) {
        showToast('Project name is required.', 'warning');
        return;
    }

    try {
        const response = await fetch(`${PROJECT_API}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description, color })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update project');
        }

        showToast(`Project "${name}" updated!`, 'success');
        setTimeout(() => location.reload(), 1000);
    } catch (error) {
        console.error('Update project error:', error);
        showToast(error.message, 'danger');
    }
}

function cancelEditProject() {
    document.getElementById('editProjectForm').classList.add('d-none');
    editingProjectId = null;
}

// ============================================================================
// Project CRUD - Delete
// ============================================================================

async function deleteProject(projectId) {
    if (!confirm('Delete this project? Snippets will be moved to "No Project".')) return;

    try {
        const response = await fetch(`${PROJECT_API}/${projectId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete project');
        const result = await response.json();
        showToast(result.message, 'success');
        setTimeout(() => location.reload(), 1000);
    } catch (error) {
        console.error('Delete project error:', error);
        showToast(error.message, 'danger');
    }
}


// ============================================================================
// Shareable Links - Share / Unshare Snippets
// ============================================================================

function setupShareButtons() {
    document.querySelectorAll('.share-btn').forEach(button => {
        button.addEventListener('click', function() {
            handleShareClick(this);
        });
    });
}

/**
 * Handle share button click:
 * - If already shared, show the link with option to copy or revoke
 * - If not shared, generate a share token and show the link
 */
async function handleShareClick(button) {
    const snippetId = button.dataset.snippetId;
    const existingToken = button.dataset.shareToken;

    if (existingToken) {
        // Already shared - show options
        showShareDialog(snippetId, existingToken, button);
    } else {
        // Not shared yet - generate link
        try {
            const response = await fetch(`/api/snippets/${snippetId}/share`, {
                method: 'POST'
            });
            if (!response.ok) throw new Error('Failed to create share link');
            const data = await response.json();

            // Update button state
            button.dataset.shareToken = data.share_token;
            button.classList.replace('btn-outline-info', 'btn-info');
            button.innerHTML = '<i class="bi bi-share-fill"></i>';

            // Show share dialog
            showShareDialog(snippetId, data.share_token, button, data.share_url);
            showToast(data.message, 'success');
        } catch (error) {
            console.error('Share error:', error);
            showToast(error.message, 'danger');
        }
    }
}

/**
 * Show a share dialog with the link and options to copy or revoke.
 */
function showShareDialog(snippetId, token, button, shareUrl) {
    if (!shareUrl) {
        shareUrl = window.location.origin + '/shared/' + token;
    }

    // Create a temporary modal for the share dialog
    const modalHtml = `
        <div class="modal fade" id="shareModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-info text-white">
                        <h5 class="modal-title"><i class="bi bi-share me-2"></i>Share Snippet</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p class="text-muted mb-3">Anyone with this link can view and copy this snippet:</p>
                        <div class="input-group mb-3">
                            <input type="text" class="form-control font-monospace small" id="shareUrlInput"
                                   value="${shareUrl}" readonly>
                            <button class="btn btn-outline-primary" onclick="copyShareLink()">
                                <i class="bi bi-clipboard"></i> Copy
                            </button>
                        </div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-outline-danger btn-sm" onclick="revokeShare('${snippetId}')">
                                <i class="bi bi-link-45deg"></i> Revoke Link
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

    // Remove existing share modal if any
    const existing = document.getElementById('shareModal');
    if (existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('shareModal'));
    modal.show();

    // Store button reference for revoke
    window._shareButtonRef = button;
    window._shareModalRef = modal;
}

/**
 * Copy the share URL to clipboard.
 */
async function copyShareLink() {
    const input = document.getElementById('shareUrlInput');
    try {
        await navigator.clipboard.writeText(input.value);
        showToast('Share link copied to clipboard!', 'success');
    } catch (e) {
        input.select();
        document.execCommand('copy');
        showToast('Share link copied!', 'success');
    }
}

/**
 * Revoke the shareable link for a snippet.
 */
async function revokeShare(snippetId) {
    if (!confirm('Revoke this shareable link? The link will stop working.')) return;

    try {
        const response = await fetch(`/api/snippets/${snippetId}/unshare`, {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Failed to revoke share');
        const data = await response.json();

        // Reset button state
        const button = window._shareButtonRef;
        if (button) {
            button.dataset.shareToken = '';
            button.classList.replace('btn-info', 'btn-outline-info');
            button.innerHTML = '<i class="bi bi-share"></i>';
        }

        // Close modal
        if (window._shareModalRef) {
            window._shareModalRef.hide();
        }

        showToast(data.message, 'success');
    } catch (error) {
        console.error('Revoke error:', error);
        showToast(error.message, 'danger');
    }
}

// ============================================================================
// Toast Notification Helper
// ============================================================================

function showToast(message, type = 'success') {
    const toastElement = document.getElementById('notificationToast');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = toastElement.querySelector('.toast-header i');

    toastMessage.textContent = message;

    const icons = {
        'success': 'check-circle', 'danger': 'exclamation-circle',
        'warning': 'exclamation-triangle', 'info': 'info-circle'
    };
    toastIcon.className = `bi bi-${icons[type] || 'check-circle'}-fill text-${type} me-2`;

    new bootstrap.Toast(toastElement, { delay: 3000 }).show();
}


// ============================================================================
// Dark Mode (localStorage-persisted)
// ============================================================================

function initDarkMode() {
    const isDark = localStorage.getItem('snippetlib-dark') === 'true';
    if (isDark) {
        document.body.classList.add('dark-mode');
        const toggle = document.getElementById('darkModeToggle');
        if (toggle) {
            toggle.classList.add('active-dark');
            toggle.innerHTML = '<i class="bi bi-sun"></i>';
        }
    }
}

function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('snippetlib-dark', isDark);
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) {
        toggle.classList.toggle('active-dark', isDark);
        toggle.innerHTML = isDark ? '<i class="bi bi-sun"></i>' : '<i class="bi bi-moon-stars"></i>';
    }
}


// ============================================================================
// Edit Profile
// ============================================================================

async function loadProfile() {
    try {
        const res = await fetch('/api/profile');
        if (!res.ok) return;
        const profile = await res.json();
        document.getElementById('profileDisplayName').value = profile.display_name || '';
        document.getElementById('profileEmail').value = profile.email || '';
        document.getElementById('profileOccupation').value = profile.occupation || '';
        document.getElementById('profileLocation').value = profile.location || '';
        document.getElementById('profileBio').value = profile.bio || '';
        updateBioCharCount();
    } catch (e) {
        console.error('Failed to load profile:', e);
    }
}

function updateBioCharCount() {
    const bio = document.getElementById('profileBio');
    const counter = document.getElementById('bioCharCount');
    if (bio && counter) counter.textContent = bio.value.length;
}

async function saveProfile(e) {
    e.preventDefault();
    const msgEl = document.getElementById('profileFormMessage');
    msgEl.className = 'alert d-none mb-0';

    const payload = {
        display_name: document.getElementById('profileDisplayName').value,
        email: document.getElementById('profileEmail').value,
        occupation: document.getElementById('profileOccupation').value,
        location: document.getElementById('profileLocation').value,
        bio: document.getElementById('profileBio').value
    };

    try {
        const res = await fetch('/api/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            msgEl.className = 'alert alert-success mb-0';
            msgEl.innerHTML = '<i class="bi bi-check-circle me-1"></i>Profile updated!';
            // Update the navbar display name
            const nameSpan = document.querySelector('.navbar .text-light');
            if (nameSpan && payload.display_name) {
                nameSpan.innerHTML = `<i class="bi bi-person-circle"></i> ${payload.display_name}`;
            }
            showNotification('Profile updated successfully!', 'success');
            setTimeout(() => {
                bootstrap.Modal.getInstance(document.getElementById('editProfileModal'))?.hide();
            }, 800);
        } else {
            msgEl.className = 'alert alert-danger mb-0';
            msgEl.innerHTML = `<i class="bi bi-exclamation-circle me-1"></i>${data.error || 'Failed to update.'}`;
        }
    } catch (err) {
        msgEl.className = 'alert alert-danger mb-0';
        msgEl.innerHTML = '<i class="bi bi-exclamation-circle me-1"></i>Network error. Please try again.';
    }
}

// Bind profile modal open event to load data
document.addEventListener('DOMContentLoaded', function() {
    const profileModal = document.getElementById('editProfileModal');
    if (profileModal) {
        profileModal.addEventListener('show.bs.modal', loadProfile);
    }
    const bioInput = document.getElementById('profileBio');
    if (bioInput) bioInput.addEventListener('input', updateBioCharCount);
});


// ============================================================================
// Command Palette (Ctrl+K)
// ============================================================================

function setupCommandPalette() {
    // Keyboard shortcut
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            openCommandPalette();
        }
        if (e.key === 'Escape') {
            const modal = document.getElementById('commandPaletteModal');
            if (modal && modal.classList.contains('show')) {
                bootstrap.Modal.getInstance(modal)?.hide();
            }
        }
    });

    // Live search in palette
    const input = document.getElementById('commandPaletteInput');
    if (input) {
        input.addEventListener('input', debounce(function() {
            filterCommandPalette(this.value);
        }, 150));
    }
}

function openCommandPalette() {
    const modal = document.getElementById('commandPaletteModal');
    if (!modal) return;
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    setTimeout(() => {
        document.getElementById('commandPaletteInput')?.focus();
        populateCommandSnippets();
    }, 300);
}

function populateCommandSnippets() {
    const container = document.getElementById('commandSnippetResults');
    if (!container) return;
    const cards = document.querySelectorAll('.snippet-col');
    let html = '';
    if (cards.length > 0) {
        html += '<div class="px-3 py-2 text-muted small fw-bold text-uppercase">Snippets</div>';
        cards.forEach(card => {
            const title = card.querySelector('.card-title')?.textContent || '';
            const lang = card.dataset.language || '';
            const id = card.querySelector('.copy-btn')?.dataset.snippetId || '';
            html += `<div class="command-item snippet-command" data-title="${title.toLowerCase()}" 
                         onclick="scrollToSnippet('${id}');bootstrap.Modal.getInstance(document.getElementById('commandPaletteModal'))?.hide();">
                        <i class="bi bi-file-code me-2 text-primary"></i>
                        <span>${title}</span>
                        <span class="badge bg-secondary ms-2" style="font-size:0.7rem">${lang}</span>
                     </div>`;
        });
    }
    container.innerHTML = html;
}

function filterCommandPalette(query) {
    const q = query.toLowerCase().trim();
    // Filter actions
    document.querySelectorAll('#commandPaletteResults > .command-item:not(.snippet-command)').forEach(item => {
        item.style.display = !q || item.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
    // Filter snippets
    document.querySelectorAll('.snippet-command').forEach(item => {
        item.style.display = !q || item.dataset.title.includes(q) ? '' : 'none';
    });
    // Hide/show section headers
    document.querySelectorAll('#commandPaletteResults > .text-uppercase').forEach(h => {
        const next = [];
        let sib = h.nextElementSibling;
        while (sib && !sib.classList.contains('text-uppercase')) {
            next.push(sib);
            sib = sib.nextElementSibling;
        }
        const anyVisible = next.some(el => el.style.display !== 'none');
        h.style.display = anyVisible ? '' : 'none';
    });
}

function scrollToSnippet(snippetId) {
    const card = document.querySelector(`.copy-btn[data-snippet-id="${snippetId}"]`)?.closest('.snippet-col');
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.querySelector('.card')?.classList.add('shadow');
        setTimeout(() => card.querySelector('.card')?.classList.remove('shadow'), 2000);
    }
}

function debounce(fn, ms) {
    let t;
    return function(...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
}


// ============================================================================
// AI Explain
// ============================================================================

let _aiCurrentSnippetId = null;
let _aiSuggestedTags = [];

function setupAiButtons() {
    document.querySelectorAll('.ai-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            explainSnippet(this.dataset.snippetId);
        });
    });
}

async function explainSnippet(snippetId) {
    _aiCurrentSnippetId = snippetId;
    const modal = new bootstrap.Modal(document.getElementById('aiExplainModal'));
    document.getElementById('aiLoading').classList.remove('d-none');
    document.getElementById('aiResult').classList.add('d-none');
    document.getElementById('aiError').classList.add('d-none');
    document.getElementById('aiApplyTagsBtn').style.display = 'none';
    modal.show();

    try {
        const resp = await fetch(`/api/snippets/${snippetId}/explain`, { method: 'POST' });
        const data = await resp.json();
        document.getElementById('aiLoading').classList.add('d-none');

        if (!resp.ok) {
            document.getElementById('aiError').textContent = data.error || 'AI request failed.';
            document.getElementById('aiError').classList.remove('d-none');
            return;
        }

        document.getElementById('aiExplanation').textContent = data.explanation || 'No explanation returned.';
        const complexityEl = document.getElementById('aiComplexity');
        complexityEl.textContent = data.complexity || 'unknown';
        const colors = { 'beginner': 'success', 'intermediate': 'warning', 'advanced': 'danger' };
        complexityEl.className = `badge bg-${colors[data.complexity] || 'secondary'}`;

        const tagsContainer = document.getElementById('aiSuggestedTags');
        _aiSuggestedTags = data.tags || [];
        tagsContainer.innerHTML = _aiSuggestedTags.map(t =>
            `<span class="badge bg-info text-dark">${t}</span>`
        ).join('');
        document.getElementById('aiApplyTagsBtn').style.display = _aiSuggestedTags.length ? '' : 'none';
        document.getElementById('aiResult').classList.remove('d-none');
    } catch (e) {
        document.getElementById('aiLoading').classList.add('d-none');
        document.getElementById('aiError').textContent = 'Network error: ' + e.message;
        document.getElementById('aiError').classList.remove('d-none');
    }
}

async function applyAiTags() {
    if (!_aiCurrentSnippetId || !_aiSuggestedTags.length) return;
    try {
        const snippet = await (await fetch(`${API_BASE}/${_aiCurrentSnippetId}`)).json();
        const existingTags = snippet.tags || [];
        const merged = [...new Set([...existingTags, ..._aiSuggestedTags])];
        await fetch(`${API_BASE}/${_aiCurrentSnippetId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tags: merged.join(',') })
        });
        showToast('Tags applied successfully!', 'success');
        setTimeout(() => location.reload(), 1000);
    } catch (e) {
        showToast('Failed to apply tags: ' + e.message, 'danger');
    }
}


// ============================================================================
// Version History
// ============================================================================

function setupVersionButtons() {
    document.querySelectorAll('.version-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            loadVersionHistory(this.dataset.snippetId);
        });
    });
}

async function loadVersionHistory(snippetId) {
    const modal = new bootstrap.Modal(document.getElementById('versionHistoryModal'));
    document.getElementById('versionLoading').classList.remove('d-none');
    document.getElementById('versionList').classList.add('d-none');
    document.getElementById('versionEmpty').classList.add('d-none');
    modal.show();

    try {
        const resp = await fetch(`/api/snippets/${snippetId}/versions`);
        const versions = await resp.json();

        document.getElementById('versionLoading').classList.add('d-none');

        if (!versions.length) {
            document.getElementById('versionEmpty').classList.remove('d-none');
            return;
        }

        const container = document.getElementById('versionItems');
        container.innerHTML = versions.map(v => `
            <div class="version-item">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <strong>v${v.version_number}</strong> — ${escHtml(v.title)}
                        <span class="badge bg-primary ms-1">${escHtml(v.language)}</span>
                    </div>
                    <small class="text-muted">${v.created_at ? new Date(v.created_at).toLocaleString() : ''}</small>
                </div>
                ${v.description ? `<small class="text-muted">${escHtml(v.description)}</small>` : ''}
                <div class="version-code">
                    <pre><code class="language-${v.language.toLowerCase()}">${escHtml(v.code_content)}</code></pre>
                </div>
            </div>
        `).join('');

        document.getElementById('versionList').classList.remove('d-none');
        hljs.highlightAll();
    } catch (e) {
        document.getElementById('versionLoading').classList.add('d-none');
        showToast('Failed to load versions: ' + e.message, 'danger');
    }
}

function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}


// ============================================================================
// Live Preview (HTML / CSS / JS snippets)
// ============================================================================

function setupRunButtons() {
    document.querySelectorAll('.run-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            runLivePreview(this.dataset.snippetId);
        });
    });
}

async function runLivePreview(snippetId) {
    try {
        const snippet = await (await fetch(`${API_BASE}/${snippetId}`)).json();
        const frame = document.getElementById('livePreviewFrame');
        const modal = new bootstrap.Modal(document.getElementById('livePreviewModal'));

        let html = snippet.code_content;
        // Wrap plain JS or CSS in an HTML shell for preview
        if (snippet.language === 'JavaScript') {
            html = `<!DOCTYPE html><html><body>
                <pre id="output" style="font-family:monospace;padding:1rem;background:#1e1e1e;color:#d4d4d4;min-height:100vh;margin:0"></pre>
                <script>
                    const _log = console.log;
                    console.log = (...args) => {
                        document.getElementById('output').textContent += args.join(' ') + '\\n';
                        _log(...args);
                    };
                    try { ${snippet.code_content} } catch(e) { console.log('Error: ' + e.message); }
                <\/script></body></html>`;
        } else if (snippet.language === 'CSS') {
            html = `<!DOCTYPE html><html><head><style>${snippet.code_content}</style></head>
                <body style="padding:1rem;font-family:sans-serif">
                <h1>CSS Preview</h1>
                <p>This is a paragraph. <a href="#">This is a link</a>.</p>
                <button class="btn">Button</button>
                <div class="container"><div class="box">Box</div></div>
                <ul><li>Item 1</li><li>Item 2</li></ul>
                </body></html>`;
        }

        frame.srcdoc = html;
        modal.show();
    } catch (e) {
        showToast('Failed to load snippet: ' + e.message, 'danger');
    }
}


// ============================================================================
// Export Snippets (JSON / ZIP)
// ============================================================================

async function exportSnippets(format) {
    try {
        const resp = await fetch(`/api/snippets/export?format=${format}`);
        if (!resp.ok) throw new Error('Export failed');
        const blob = await resp.blob();
        const filename = format === 'zip' ? 'snippet_library_export.zip' : 'snippet_library_export.json';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`Exported as ${format.toUpperCase()}!`, 'success');
    } catch (e) {
        showToast('Export failed: ' + e.message, 'danger');
    }
}


// ============================================================================
// Download Single Snippet
// ============================================================================

function setupDownloadButtons() {
    document.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            downloadSnippet(this.dataset.snippetId);
        });
    });
}

async function downloadSnippet(snippetId) {
    try {
        const resp = await fetch(`/api/snippets/${snippetId}/download`);
        if (!resp.ok) throw new Error('Download failed');
        const blob = await resp.blob();
        const disposition = resp.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename="?([^"]+)"?/);
        const filename = match ? match[1] : `snippet_${snippetId}.txt`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`Downloaded ${filename}`, 'success');
    } catch (e) {
        showToast('Download failed: ' + e.message, 'danger');
    }
}


// ============================================================================
// Toggle Public Visibility
// ============================================================================

function setupPublicButtons() {
    document.querySelectorAll('.public-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            togglePublic(this);
        });
    });
}

async function togglePublic(button) {
    const snippetId = button.dataset.snippetId;
    try {
        const resp = await fetch(`/api/snippets/${snippetId}/toggle-public`, { method: 'POST' });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.message || 'Failed');

        button.dataset.isPublic = data.is_public;
        button.classList.toggle('active-public', data.is_public);
        button.innerHTML = data.is_public ? '<i class="bi bi-globe"></i>' : '<i class="bi bi-globe2"></i>';
        showToast(data.message, 'success');
    } catch (e) {
        showToast('Error: ' + e.message, 'danger');
    }
}


// ============================================================================
// GitHub Gist Import
// ============================================================================

async function importGist() {
    const url = document.getElementById('gistUrlInput').value.trim();
    const status = document.getElementById('gistImportStatus');
    const btn = document.getElementById('gistImportBtn');

    if (!url) {
        showToast('Please enter a Gist URL.', 'warning');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Importing...';
    status.classList.remove('d-none');
    status.innerHTML = '<div class="text-muted"><span class="spinner-border spinner-border-sm"></span> Fetching Gist...</div>';

    try {
        const resp = await fetch('/api/gists/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await resp.json();

        if (!resp.ok) {
            status.innerHTML = `<div class="alert alert-danger mb-0">${data.error}</div>`;
            return;
        }

        status.innerHTML = `<div class="alert alert-success mb-0">
            <i class="bi bi-check-circle me-1"></i> ${data.message}
            <ul class="mb-0 mt-2 small">${data.files.map(f => `<li>${f}</li>`).join('')}</ul>
        </div>`;
        showToast(data.message, 'success');
        setTimeout(() => location.reload(), 2500);
    } catch (e) {
        status.innerHTML = `<div class="alert alert-danger mb-0">Network error: ${e.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-download me-1"></i> Import';
    }
}
