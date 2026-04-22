const collapsedGroups = new Set();
const disabledGroups = new Set();
let draggedGroupName = null;
let groupSortOrderPreference = 'alphabetic';
let showRecentGroupFirstPreference = false;
let showGroupRuleCountPreference = false;
let recentGroupSelection = '';

const optionsMutationHelpers = {
    buildSavePatternUpdate: globalThis.buildSavePatternUpdate || ((existingPatterns, input) => {
        const next = [...existingPatterns];
        const pattern = { search: input.search, title: input.title };
        if (input.groupValue) pattern.group = input.groupValue;
        next.push(pattern);
        const update = { patterns: next };
        if (input.groupValue) update.recentGroupSelection = input.groupValue;
        return update;
    }),
    buildSaveRowUpdate: globalThis.buildSaveRowUpdate || ((existingPatterns, targetIndex, input) => {
        const next = existingPatterns.map(p => ({ ...p }));
        if (!next[targetIndex]) return { patterns: next };

        const oldGroup = next[targetIndex].group || '';
        const newGroup = input.groupValue || '';
        const updatedPattern = {
            search: input.search,
            title: input.title,
            enabled: next[targetIndex].enabled !== false,
        };
        if (newGroup) updatedPattern.group = newGroup;

        if (newGroup !== oldGroup) {
            next.splice(targetIndex, 1);
            let insertAt = -1;
            for (let i = 0; i < next.length; i++) {
                if ((next[i].group || '') === newGroup) insertAt = i;
            }
            if (insertAt === -1) next.push(updatedPattern);
            else next.splice(insertAt + 1, 0, updatedPattern);
        } else {
            next[targetIndex] = updatedPattern;
        }

        const update = { patterns: next };
        if (newGroup) update.recentGroupSelection = newGroup;
        return update;
    }),
    buildPatternEnabledUpdate: globalThis.buildPatternEnabledUpdate || ((existingPatterns, targetIndex, enabled) => {
        const next = existingPatterns.map(p => ({ ...p }));
        if (next[targetIndex]) next[targetIndex].enabled = enabled;
        return { patterns: next };
    }),
    buildDisabledGroupsUpdate: globalThis.buildDisabledGroupsUpdate || ((current, targetGroup, disabled) => {
        const next = new Set(Array.from(current || []));
        if (disabled) next.add(targetGroup);
        else next.delete(targetGroup);
        return Array.from(next);
    }),
};

// Auto-scroll during drag
let lastDragEvent = null;
let autoScrollRAF = null;

function handleAutoScroll(container) {
    if (!lastDragEvent) {
        autoScrollRAF = requestAnimationFrame(() => handleAutoScroll(container));
        return;
    }

    const rect = container.getBoundingClientRect();
    const threshold = 50; // Threshold zone in pixels
    const topDist = lastDragEvent.clientY - rect.top;
    const bottomDist = rect.bottom - lastDragEvent.clientY;
    let scrollAmount = 0;

    if (topDist < threshold && container.scrollTop > 0) {
        // Clamp topDist at 0 for speed calculation if outside
        const effectiveDist = Math.max(0, topDist);
        scrollAmount = -Math.max(2, (threshold - effectiveDist) / 2.5);
    } else if (bottomDist < threshold && container.scrollTop + container.clientHeight < container.scrollHeight) {
        // Clamp bottomDist at 0 for speed calculation if outside
        const effectiveDist = Math.max(0, bottomDist);
        scrollAmount = Math.max(2, (threshold - effectiveDist) / 2.5);
    }

    if (scrollAmount !== 0) {
        container.scrollTop += scrollAmount;
    }

    autoScrollRAF = requestAnimationFrame(() => handleAutoScroll(container));
}

function stopAutoScroll() {
    if (autoScrollRAF) {
        cancelAnimationFrame(autoScrollRAF);
        autoScrollRAF = null;
    }
    lastDragEvent = null;
}

document.addEventListener('DOMContentLoaded', async () => {
    // Theme handling
    const themeRadios = [
        document.getElementById('theme-light'),
        document.getElementById('theme-dark'),
        document.getElementById('theme-system')
    ];

    // Helper to apply theme
    function applyTheme(theme) {
        document.body.classList.remove('theme-light', 'theme-dark');
        if (theme === 'dark') {
            document.body.classList.add('theme-dark');
        } else if (theme === 'light') {
            document.body.classList.add('theme-light');
        } else if (theme === 'system') {
            // Use system preference
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.body.classList.remove('theme-light', 'theme-dark');
            document.body.classList.add(isDark ? 'theme-dark' : 'theme-light');
        }
    }

    // Listen for system theme changes if 'system' is selected
    let systemThemeListener = null;
    function setSystemThemeListener(enabled) {
        if (systemThemeListener) {
            window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', systemThemeListener);
            systemThemeListener = null;
        }
        if (enabled) {
            systemThemeListener = (e) => {
                // Always remove both classes before applying
                document.body.classList.remove('theme-light', 'theme-dark');
                applyTheme('system');
            };
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', systemThemeListener);
        }
    }

    // Restore theme from storage
    const { theme = 'light' } = await browser.storage.local.get('theme');
    themeRadios.forEach(r => r.checked = (r.value === theme));
    applyTheme(theme);
    setSystemThemeListener(theme === 'system');

    themeRadios.forEach(radio => {
        radio.addEventListener('change', async () => {
            if (radio.checked) {
                await browser.storage.local.set({ theme: radio.value });
                applyTheme(radio.value);
                setSystemThemeListener(radio.value === 'system');
            }
        });
    });
    console.log('DOMContentLoaded');
    await restoreOptions().catch(console.error);

    document.getElementById('pattern-form').addEventListener('submit', (event) => {
        event.preventDefault(); // Prevent the form from submitting
        savePattern(event).catch(console.error);
    });

    document.getElementById('notes-button').addEventListener('click', openNotes);

    // Setup collapsible sections
    function setupToggle(buttonId, contentId, startExpanded = false) {
        const button = document.getElementById(buttonId);
        const content = document.getElementById(contentId);
        if (!button || !content) return;

        const setExpanded = (isExpanded) => {
            if (isExpanded) {
                content.style.display = 'block';
                button.classList.remove('collapsed');
                button.classList.add('expanded');
            } else {
                content.style.display = 'none';
                button.classList.remove('expanded');
                button.classList.add('collapsed');
            }
        };

        button.addEventListener('click', () => {
            const isExpanding = content.style.display === 'none' || content.style.display === '';
            setExpanded(isExpanding);
        });

        setExpanded(startExpanded);
    }

    setupToggle('toggle-add-rule', 'add-rule-content', false);
    setupToggle('toggle-options', 'additional-options', false);

    // Load the loadDiscardedTabs value from storage and set the checkbox state
    // const { loadDiscardedTabs = true, reDiscardTabs = true, discardDelay = 1 } = await browser.storage.local.get(['loadDiscardedTabs', 'reDiscardTabs', 'discardDelay']);
    const {
        loadDiscardedTabs,
        reDiscardTabs,
        discardDelay,
        limitConcurrentTabsEnabled,
        maxConcurrentTabs,
        groupSortOrder,
        showRecentGroupFirst,
        showGroupRuleCount,
        recentGroupSelection: storedRecentGroupSelection,
        diagLogging,
    } = await browser.storage.local.get([
        'loadDiscardedTabs',
        'reDiscardTabs',
        'discardDelay',
        'limitConcurrentTabsEnabled',
        'maxConcurrentTabs',
        'groupSortOrder',
        'showRecentGroupFirst',
        'showGroupRuleCount',
        'recentGroupSelection',
        'diagLogging',
    ]);

    groupSortOrderPreference = groupSortOrder || 'alphabetic';
    showRecentGroupFirstPreference = showRecentGroupFirst === true;
    showGroupRuleCountPreference = showGroupRuleCount === true;
    recentGroupSelection = storedRecentGroupSelection || '';
    const groupSortOrderWrapper = document.getElementById('group-sort-order-wrapper');
    const groupSortOrderHidden = document.getElementById('group-sort-order');
    if (groupSortOrderWrapper) {
        initCustomSelect(groupSortOrderWrapper);
        setCustomSelectValue(groupSortOrderWrapper, groupSortOrderPreference,
            groupSortOrderPreference === 'table' ? 'Table order' : 'Alphabetic');
        groupSortOrderWrapper.addEventListener('customselect', async function () {
            groupSortOrderPreference = groupSortOrderHidden.value || 'alphabetic';
            await browser.storage.local.set({ groupSortOrder: groupSortOrderPreference });
            await restoreOptions();
        });
    }

    const showRecentGroupFirstCheckbox = document.getElementById('group-show-recent-first');
    if (showRecentGroupFirstCheckbox) {
        showRecentGroupFirstCheckbox.checked = showRecentGroupFirstPreference;
        showRecentGroupFirstCheckbox.addEventListener('change', async function () {
            showRecentGroupFirstPreference = this.checked;
            await browser.storage.local.set({ showRecentGroupFirst: showRecentGroupFirstPreference });
            await restoreOptions();
        });
    }

    const showGroupRuleCountCheckbox = document.getElementById('group-show-rule-count');
    if (showGroupRuleCountCheckbox) {
        showGroupRuleCountCheckbox.checked = showGroupRuleCountPreference;
        showGroupRuleCountCheckbox.addEventListener('change', async function () {
            showGroupRuleCountPreference = this.checked;
            await browser.storage.local.set({ showGroupRuleCount: showGroupRuleCountPreference });
            await restoreOptions();
        });
    }

    // Write default values to storage if they are used
    /*
    if (loadDiscardedTabs === true) {
        browser.storage.local.set({ loadDiscardedTabs });
    }
    if (reDiscardTabs === true) {
        browser.storage.local.set({ reDiscardTabs });
    }
    if (discardDelay === 1) {
        browser.storage.local.set({ discardDelay });
    }
    */
    document.getElementById('discarded-tabs-option').checked = loadDiscardedTabs;
    document.getElementById('discard-delay-enabled').checked = reDiscardTabs;
    document.getElementById('discard-delay').value = discardDelay;
    
    // Default limitConcurrentTabsEnabled to true, and maxConcurrentTabs to 10 if not set
    const isLimitEnabled = limitConcurrentTabsEnabled !== undefined ? limitConcurrentTabsEnabled : true;
    const maxTabsValue = maxConcurrentTabs !== undefined && maxConcurrentTabs > 0 ? maxConcurrentTabs : 10;
    
    document.getElementById('limit-concurrent-tabs-enabled').checked = isLimitEnabled;
    document.getElementById('max-concurrent-tabs').value = maxTabsValue;

    // Show or hide discard delay options based on loadDiscardedTabs state
    document.getElementById('discarded-tabs-options-details').style.display = loadDiscardedTabs ? 'block' : 'none';

    document.getElementById('discarded-tabs-option').addEventListener('change', function () {
        const loadDiscardedTabs = this.checked;
        browser.storage.local.set({ loadDiscardedTabs });
        document.getElementById('discarded-tabs-options-details').style.display = loadDiscardedTabs ? 'block' : 'none';
    });

    document.getElementById('discard-delay-enabled').addEventListener('change', function () {
        const reDiscardTabs = this.checked;
        browser.storage.local.set({ reDiscardTabs });
    });

    document.getElementById('discard-delay').addEventListener('input', function () {
        const val = parseInt(this.value, 10);
        const discardDelay = isNaN(val) ? 1 : val;
        browser.storage.local.set({ discardDelay });
    });

    document.getElementById('limit-concurrent-tabs-enabled').addEventListener('change', function () {
        const limitConcurrentTabsEnabled = this.checked;
        browser.storage.local.set({ limitConcurrentTabsEnabled });
    });

    document.getElementById('max-concurrent-tabs').addEventListener('input', function () {
        const maxConcurrentTabs = parseInt(this.value, 10) || 10; // Fallback to 10 instead of 0
        if (maxConcurrentTabs < 1) {
            this.value = 1;
            browser.storage.local.set({ maxConcurrentTabs: 1 });
        } else {
            browser.storage.local.set({ maxConcurrentTabs });
        }
    });

    // Diagnostic logging toggle
    const diagLoggingCheckbox = document.getElementById('diag-logging-option');
    if (diagLoggingCheckbox) {
        diagLoggingCheckbox.checked = diagLogging === true;
        diagLoggingCheckbox.addEventListener('change', function () {
            browser.storage.local.set({ diagLogging: this.checked });
        });
    }

    const table = document.getElementById('pattern-table');
    const scrollContainer = document.querySelector('.patterns-table-container');
    setupFirefoxOverlayScrollbar(scrollContainer);

    table.addEventListener('click', (event) => {
        const headerRow = event.target.closest('tr.group-header');
        // Only intercept if it's a group header AND not a child button or switch
        if (headerRow && !event.target.closest('button') && !event.target.closest('.switch')) {
            event.preventDefault();
            toggleGroupCollapse(headerRow);
        }
    });

    // Dynamically manage draggability to prevent interference with text selection.
    // Inputs inside draggable rows are known to have selection issues in Chromium.
    table.addEventListener('mousedown', (event) => {
        const handle = event.target.closest('.row-drag-handle, .drag-handle');
        const row = event.target.closest('tr');
        if (handle && row) {
            row.setAttribute('draggable', 'true');
        }
    });

    const resetDraggable = (event) => {
        const row = event.target.closest('tr');
        if (row) row.setAttribute('draggable', 'false');
    };

    table.addEventListener('mouseup', resetDraggable);
    table.addEventListener('dragend', resetDraggable);

    // In-table custom dropdowns: listen for custom 'customselect' events via delegation
    table.addEventListener('customselect', (event) => {
        const wrapper = event.target.closest('.custom-select');
        if (!wrapper) return;
        const row = wrapper.closest('tr');
        if (!row) return;
        const newGroupInput = row.querySelector('.new-group-input-row');
        if (newGroupInput) {
            const val = wrapper.querySelector('input[type="hidden"]').value;
            newGroupInput.style.display = val === '__new__' ? 'inline-block' : 'none';
            if (val === '__new__') newGroupInput.focus();
        }
    });

    // Add-rule form custom dropdown: listen for value changes
    const groupSelectWrapper = document.getElementById('group-select-wrapper');
    initCustomSelect(groupSelectWrapper);
    groupSelectWrapper.addEventListener('customselect', function () {
        const val = document.getElementById('group-select').value;
        const newGroupInput = document.getElementById('new-group-input');
        newGroupInput.style.display = val === '__new__' ? 'inline-block' : 'none';
        if (val === '__new__') newGroupInput.focus();
    });

    // Close all custom dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        document.querySelectorAll('.custom-select.open').forEach(cs => {
            // Also ensure we don't close if they clicked INSIDE the detached options panel
            if (!cs.contains(e.target) && !e.target.closest('.custom-select-options')) {
                if (cs.closeSelect) cs.closeSelect();
                else cs.classList.remove('open');
            }
        });
    });

    // Close custom dropdowns when the table container scrolls (position:fixed panels
    // don't track with scroll, so we close them to avoid visual detachment).
    if (scrollContainer) {
        scrollContainer.addEventListener('scroll', () => {
            document.querySelectorAll('.custom-select.open').forEach(cs => {
                if (cs.closeSelect) cs.closeSelect();
                else cs.classList.remove('open');
            });
        }, { passive: true });

        // Update cursor position for auto-scroll globally during drag
        window.addEventListener('dragover', (e) => {
            lastDragEvent = e;
        }, { passive: true });
    }

    document.getElementById('import-export-button').addEventListener('click', () => {
        window.open('../import-export/import-export.html', '_blank');
    });
    document.getElementById('icon-coloring-button').addEventListener('click', () => {
        window.open('../notes/icon-coloring.html', '_blank');
    });
});

function setupFirefoxOverlayScrollbar(container) {
    if (!container || !navigator.userAgent.includes('Firefox')) return;

    container.classList.add('firefox-overlay-scroll');

    const overlay = document.createElement('div');
    overlay.className = 'overlay-scrollbar';
    const thumb = document.createElement('div');
    thumb.className = 'overlay-scrollbar-thumb';
    overlay.appendChild(thumb);
    container.appendChild(overlay);

    let hideTimer = null;
    const minThumbHeight = 18;
    let lastScrollTop = -1;
    let lastClientHeight = -1;
    let lastScrollHeight = -1;

    const updateThumb = () => {
        const scrollTop = container.scrollTop;
        const viewportHeight = container.clientHeight;
        const totalContentHeight = container.scrollHeight;
        const maxScrollTop = Math.max(0, totalContentHeight - viewportHeight);
        const header = container.querySelector('thead');
        const headerHeight = header ? header.getBoundingClientRect().height : 0;

        // Start the custom track at the first data row (below sticky header).
        overlay.style.top = `${Math.round(headerHeight)}px`;

        // The overlay element lives inside the scroll container; counter-scroll it so
        // the track stays visually fixed while table rows move underneath.
        overlay.style.transform = `translateY(${scrollTop}px)`;

        if (maxScrollTop <= 0) {
            overlay.classList.remove('visible');
            thumb.style.height = '0px';
            thumb.style.transform = 'translateY(0px)';
            return;
        }

        const trackHeight = Math.max(0, overlay.clientHeight);
        const thumbHeight = Math.max(minThumbHeight, (viewportHeight / totalContentHeight) * trackHeight);
        const maxTravel = Math.max(0, trackHeight - thumbHeight);
        const ratio = maxScrollTop > 0 ? Math.min(1, Math.max(0, scrollTop / maxScrollTop)) : 0;
        const offsetY = ratio * maxTravel;

        thumb.style.height = `${thumbHeight}px`;
        thumb.style.transform = `translateY(${offsetY}px)`;
    };

    const syncThumb = () => {
        if (
            container.scrollTop !== lastScrollTop
            || container.clientHeight !== lastClientHeight
            || container.scrollHeight !== lastScrollHeight
        ) {
            lastScrollTop = container.scrollTop;
            lastClientHeight = container.clientHeight;
            lastScrollHeight = container.scrollHeight;
            updateThumb();
        }

        requestAnimationFrame(syncThumb);
    };

    const showWhileScrolling = () => {
        updateThumb();
        overlay.classList.add('visible');
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            overlay.classList.remove('visible');
        }, 450);
    };

    container.addEventListener('scroll', showWhileScrolling, { passive: true });
    window.addEventListener('resize', updateThumb);
    requestAnimationFrame(updateThumb);
    requestAnimationFrame(syncThumb);
}

async function savePattern(event) {
    console.log('savePattern');
    const search = document.getElementById('search').value;
    const title = document.getElementById('title').value;
    const groupValue = getGroupSelectValue(
        document.getElementById('group-select-wrapper'),
        document.getElementById('new-group-input')
    );

    try {
        const result = await browser.storage.local.get('patterns');
        const patterns = result.patterns || [];
        const storageUpdate = optionsMutationHelpers.buildSavePatternUpdate(patterns, { search, title, groupValue });
        await browser.storage.local.set(storageUpdate);
        if (storageUpdate.recentGroupSelection) {
            recentGroupSelection = storageUpdate.recentGroupSelection;
        }
        await restoreOptions();

        // Clear the input fields
        document.getElementById('search').value = '';
        document.getElementById('title').value = '';
        setCustomSelectValue(document.getElementById('group-select-wrapper'), '', '(No group)');
        document.getElementById('new-group-input').style.display = 'none';
        document.getElementById('new-group-input').value = '';

        // The background script automatically syncs tabs via storage listener
    } catch (error) {
        console.error('Error saving pattern:', error);
    }
}

// Note: escapeHTML, getOrderedGroupNames and computeScrollThumb are mirrored in
// src/lib/group-utils.js for unit-test coverage. Keep them in sync.
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ── Custom dropdown helpers ─────────────────────────────────────────

// Initialize click/keyboard behaviour on a .custom-select wrapper.
// This must be called once per wrapper element (idempotent via data flag).
function initCustomSelect(wrapper) {
    if (!wrapper || wrapper.dataset.csInit) return;
    wrapper.dataset.csInit = '1';

    const trigger = wrapper.querySelector('.custom-select-trigger');
    const optionsContainer = wrapper.querySelector('.custom-select-options');

    wrapper.closeSelect = () => {
        wrapper.classList.remove('open');
        wrapper.classList.remove('dropup');
        optionsContainer.classList.remove('visible');
        optionsContainer.classList.remove('dropup');
        // Return optionsContainer to its rightful place inside the wrapper
        if (optionsContainer.parentNode === document.body) {
            wrapper.appendChild(optionsContainer);
        }
    };

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close any other open custom selects first
        document.querySelectorAll('.custom-select.open').forEach(cs => {
            if (cs !== wrapper) {
                if (cs.closeSelect) cs.closeSelect();
                else cs.classList.remove('open');
            }
        });

        // If closing, just toggle and return
        if (wrapper.classList.contains('open')) {
            wrapper.closeSelect();
            return;
        }

        // Move to document.body to escape any parent "transform: translateZ" which
        // would break position:fixed coordinate correctness.
        document.body.appendChild(optionsContainer);
        optionsContainer.classList.add('visible');

        // Position the fixed options panel relative to the trigger's screen coords
        const triggerRect = trigger.getBoundingClientRect();
        const spaceBelow = window.innerHeight - triggerRect.bottom;
        const optionsMaxH = 200; // matches CSS max-height

        optionsContainer.style.left = triggerRect.left + 'px';
        optionsContainer.style.width = triggerRect.width + 'px';

        if (spaceBelow < optionsMaxH && triggerRect.top > optionsMaxH) {
            // Open upward
            wrapper.classList.add('dropup');
            optionsContainer.classList.add('dropup');
            optionsContainer.style.top = 'auto';
            optionsContainer.style.bottom = (window.innerHeight - triggerRect.top) + 'px';
        } else {
            // Open downward
            wrapper.classList.remove('dropup');
            optionsContainer.classList.remove('dropup');
            optionsContainer.style.top = triggerRect.bottom + 'px';
            optionsContainer.style.bottom = 'auto';
        }

        wrapper.classList.add('open');
    });

    // Keyboard navigation
    trigger.addEventListener('keydown', (e) => {
        if (e.key === ' ') {
            e.preventDefault();
            trigger.click();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (wrapper.classList.contains('open')) {
                const highlighted = optionsContainer.querySelector('.custom-select-option.highlighted');
                if (highlighted) highlighted.click();
            } else {
                trigger.click();
            }
        } else if (e.key === 'Escape') {
            wrapper.closeSelect();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!wrapper.classList.contains('open')) {
                trigger.click();
                return;
            }
            const items = Array.from(optionsContainer.querySelectorAll('.custom-select-option:not(.disabled):not(.separator)'));
            const highlighted = optionsContainer.querySelector('.custom-select-option.highlighted');
            let idx = highlighted ? items.indexOf(highlighted) : -1;
            items.forEach(i => i.classList.remove('highlighted'));
            if (e.key === 'ArrowDown') idx = Math.min(idx + 1, items.length - 1);
            else idx = Math.max(idx - 1, 0);
            if (items[idx]) {
                items[idx].classList.add('highlighted');
                items[idx].scrollIntoView({ block: 'nearest' });
            }
        }
    });

    // Handle option clicks via delegation
    optionsContainer.addEventListener('click', (e) => {
        const option = e.target.closest('.custom-select-option');
        if (!option || option.classList.contains('disabled') || option.classList.contains('separator')) return;
        e.stopPropagation();

        const value = option.dataset.value;
        const text = option.textContent;
        const hiddenInput = wrapper.querySelector('input[type="hidden"]');
        const textSpan = wrapper.querySelector('.custom-select-text');

        hiddenInput.value = value;
        textSpan.textContent = text;

        // Update selected styling
        optionsContainer.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');

        wrapper.closeSelect();
        wrapper.dispatchEvent(new Event('customselect', { bubbles: true }));
    });
}

// Programmatically set a custom-select value.
function setCustomSelectValue(wrapper, value, displayText) {
    if (!wrapper) return;
    const hiddenInput = wrapper.querySelector('input[type="hidden"]');
    const textSpan = wrapper.querySelector('.custom-select-text');
    if (hiddenInput) hiddenInput.value = value;
    if (textSpan) textSpan.textContent = displayText || value || '(No group)';
    // Update selected styling
    const optionsContainer = wrapper.querySelector('.custom-select-options');
    if (optionsContainer) {
        optionsContainer.querySelectorAll('.custom-select-option').forEach(o => {
            o.classList.toggle('selected', o.dataset.value === value);
        });
    }
}

// Build a custom-select wrapper element from scratch (for in-table use).
function createCustomSelectElement() {
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select';

    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.className = 'group-select-input';
    hidden.value = '';
    wrapper.appendChild(hidden);

    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';
    trigger.tabIndex = 0;
    const textSpan = document.createElement('span');
    textSpan.className = 'custom-select-text';
    textSpan.textContent = '(No group)';
    trigger.appendChild(textSpan);
    wrapper.appendChild(trigger);

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'custom-select-options';
    wrapper.appendChild(optionsContainer);

    initCustomSelect(wrapper);
    return wrapper;
}

// Populate a custom-select wrapper with group options.
function buildGroupSelect(wrapperOrHiddenInput, patterns, selectedGroup) {
    // Accept either the .custom-select wrapper or the hidden input inside it
    let wrapper = wrapperOrHiddenInput;
    if (wrapper.tagName === 'INPUT') {
        wrapper = wrapper.closest('.custom-select');
    }
    if (!wrapper) return;

    const hiddenInput = wrapper.querySelector('input[type="hidden"]');
    const optionsContainer = wrapper.querySelector('.custom-select-options');
    const textSpan = wrapper.querySelector('.custom-select-text');
    const prevVal = hiddenInput.value;

    optionsContainer.innerHTML = '';
    const groupNames = getOrderedGroupNames(patterns, groupSortOrderPreference);
    const selectableGroupNames = [...groupNames];

    // Recent group at top
    if (showRecentGroupFirstPreference && recentGroupSelection && groupNames.includes(recentGroupSelection)) {
        const recentDiv = document.createElement('div');
        recentDiv.className = 'custom-select-option';
        recentDiv.dataset.value = recentGroupSelection;
        recentDiv.textContent = recentGroupSelection;
        optionsContainer.appendChild(recentDiv);

        const sep = document.createElement('div');
        sep.className = 'custom-select-option separator';
        optionsContainer.appendChild(sep);

        selectableGroupNames.splice(selectableGroupNames.indexOf(recentGroupSelection), 1);
        selectableGroupNames.unshift(recentGroupSelection);
        groupNames.splice(groupNames.indexOf(recentGroupSelection), 1);
    }

    // (No group)
    const noGroupDiv = document.createElement('div');
    noGroupDiv.className = 'custom-select-option';
    noGroupDiv.dataset.value = '';
    noGroupDiv.textContent = '(No group)';
    optionsContainer.appendChild(noGroupDiv);

    // Group names
    for (const name of groupNames) {
        const div = document.createElement('div');
        div.className = 'custom-select-option';
        div.dataset.value = name;
        div.textContent = name;
        optionsContainer.appendChild(div);
    }

    // Separator before "New group..."
    const sepNew = document.createElement('div');
    sepNew.className = 'custom-select-option separator';
    optionsContainer.appendChild(sepNew);

    // New group...
    const newDiv = document.createElement('div');
    newDiv.className = 'custom-select-option';
    newDiv.dataset.value = '__new__';
    newDiv.textContent = 'New group\u2026';
    optionsContainer.appendChild(newDiv);

    // Set selected value
    let resolvedValue;
    if (selectedGroup !== undefined) {
        resolvedValue = (selectedGroup && selectableGroupNames.includes(selectedGroup)) ? selectedGroup : '';
    } else {
        resolvedValue = prevVal || '';
    }

    const matchingOption = optionsContainer.querySelector(`.custom-select-option[data-value="${CSS.escape(resolvedValue)}"]`);
    const displayText = matchingOption ? matchingOption.textContent : '(No group)';
    setCustomSelectValue(wrapper, resolvedValue, displayText);

    // Ensure this wrapper is initialised
    initCustomSelect(wrapper);
}

function getOrderedGroupNames(patterns, sortOrder) {
    const groupNames = [...new Set(patterns.map(p => p.group).filter(Boolean))];

    if (sortOrder === 'table') {
        return groupNames;
    }

    return groupNames.sort((left, right) => left.localeCompare(right));
}

// Read resolved group value from a custom-select wrapper (or hidden input) + companion new-name input
function getGroupSelectValue(selectElOrWrapper, newInputEl) {
    if (!selectElOrWrapper) return '';
    // If it's a custom-select wrapper, read from the hidden input
    let value;
    if (selectElOrWrapper.classList && selectElOrWrapper.classList.contains('custom-select')) {
        value = selectElOrWrapper.querySelector('input[type="hidden"]').value;
    } else {
        // Hidden input directly
        value = selectElOrWrapper.value;
    }
    if (value === '__new__') {
        return newInputEl ? newInputEl.value.trim() : '';
    }
    return value;
}

// Toggle the collapsed/expanded state of a group header row
function toggleGroupCollapse(headerRow) {
    const groupName = headerRow.getAttribute('data-group');
    const toggle = headerRow.querySelector('.group-toggle');
    const tbody = headerRow.parentElement;
    // Only select pattern rows (not group header rows) by filtering on .pattern-row class
    const rows = Array.from(tbody.querySelectorAll('tr.pattern-row')).filter(
        r => r.getAttribute('data-group') === groupName
    );
    if (collapsedGroups.has(groupName)) {
        collapsedGroups.delete(groupName);
        rows.forEach(r => { r.style.display = ''; });
        if (toggle) toggle.classList.remove('collapsed');
        if (toggle) toggle.classList.add('expanded');
    } else {
        collapsedGroups.add(groupName);
        rows.forEach(r => { r.style.display = 'none'; });
        if (toggle) toggle.classList.remove('expanded');
        if (toggle) toggle.classList.add('collapsed');
    }
    // Defensive: always keep the header row itself visible
    headerRow.style.display = '';
    // Persist collapse state
    browser.storage.local.set({ collapsedGroups: [...collapsedGroups] });
}

// Rename all patterns in a group
async function renameGroup(oldName) {
    const dialog = document.getElementById('rename-group-dialog');
    const input = document.getElementById('rename-group-input');
    const msg = document.getElementById('rename-group-dialog-message');
    const okBtn = document.getElementById('rename-group-ok-btn');
    const cancelBtn = document.getElementById('rename-group-cancel-btn');

    msg.innerText = `Rename group "${oldName}" to:`;
    input.value = oldName;

    return new Promise((resolve) => {
        const onOk = async () => {
            const newName = input.value.trim();
            if (newName && newName !== oldName) {
                const result = await browser.storage.local.get('patterns');
                const patterns = result.patterns || [];
                patterns.forEach(p => { if (p.group === oldName) p.group = newName; });
                await browser.storage.local.set({ patterns });

                // Sync disabledGroups if needed
                const { disabledGroups: storedDisabled } = await browser.storage.local.get('disabledGroups');
                if (Array.isArray(storedDisabled) && storedDisabled.includes(oldName)) {
                    const nextDisabled = storedDisabled.map(g => g === oldName ? newName : g);
                    await browser.storage.local.set({ disabledGroups: nextDisabled });
                    disabledGroups.clear();
                    nextDisabled.forEach(g => disabledGroups.add(g));
                }

                if (collapsedGroups.has(oldName)) {
                    collapsedGroups.delete(oldName);
                    collapsedGroups.add(newName);
                    await browser.storage.local.set({ collapsedGroups: [...collapsedGroups] });
                }
                await restoreOptions();
            }
            cleanup();
            resolve();
        };

        const onCancel = () => {
            cleanup();
            resolve();
        };

        const onKey = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                onOk();
            }
        };

        const cleanup = () => {
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            input.removeEventListener('keydown', onKey);
            dialog.close();
        };

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        input.addEventListener('keydown', onKey);

        dialog.showModal();
        input.select();
        input.focus();
    });
}

// Show the delete-group dialog modal
async function showDeleteGroupDialog(groupName) {
    const dialog = document.getElementById('delete-group-dialog');
    const result = await browser.storage.local.get('patterns');
    const patterns = result.patterns || [];
    const groupPatternsCount = patterns.filter(p => p.group === groupName).length;

    document.getElementById('delete-group-dialog-message').innerText =
        `Group "${groupName}" contains ${groupPatternsCount} pattern${groupPatternsCount === 1 ? '' : 's'}.\n\nWhat would you like to do with them?`;

    document.getElementById('delete-group-ungroup-btn').onclick = async () => {
        dialog.close();
        const result = await browser.storage.local.get('patterns');
        const patterns = result.patterns || [];
        patterns.forEach(p => { if (p.group === groupName) delete p.group; });
        await browser.storage.local.set({ patterns });
        collapsedGroups.delete(groupName);

        // Sync disabledGroups
        const { disabledGroups: storedDisabled } = await browser.storage.local.get('disabledGroups');
        if (Array.isArray(storedDisabled) && storedDisabled.includes(groupName)) {
            const nextDisabled = storedDisabled.filter(g => g !== groupName);
            await browser.storage.local.set({ disabledGroups: nextDisabled });
            disabledGroups.clear();
            nextDisabled.forEach(g => disabledGroups.add(g));
        }

        browser.storage.local.set({ collapsedGroups: [...collapsedGroups] });
        await restoreOptions();
    };

    document.getElementById('delete-group-deleteall-btn').onclick = async () => {
        dialog.close();
        const result = await browser.storage.local.get('patterns');
        let patterns = result.patterns || [];
        patterns = patterns.filter(p => p.group !== groupName);
        await browser.storage.local.set({ patterns });
        collapsedGroups.delete(groupName);

        // Sync disabledGroups
        const { disabledGroups: storedDisabled } = await browser.storage.local.get('disabledGroups');
        if (Array.isArray(storedDisabled) && storedDisabled.includes(groupName)) {
            const nextDisabled = storedDisabled.filter(g => g !== groupName);
            await browser.storage.local.set({ disabledGroups: nextDisabled });
            disabledGroups.clear();
            nextDisabled.forEach(g => disabledGroups.add(g));
        }

        browser.storage.local.set({ collapsedGroups: [...collapsedGroups] });
        await restoreOptions();
    };

    document.getElementById('delete-group-cancel-btn').onclick = () => dialog.close();
    dialog.showModal();
}

// Build a single pattern <tr> for the table body
function createPatternRow(pattern, index, groupName, isGroupDisabled = false) {
    const escapedSearch = escapeHTML(pattern.search);
    const escapedTitle = escapeHTML(pattern.title);
    const isEnabled = pattern.enabled !== false;
    const row = document.createElement('tr');
    row.classList.add('pattern-row');
    if (!isEnabled || isGroupDisabled) {
        row.classList.add('disabled-visual');
    }
    row.setAttribute('data-index', index);
    row.setAttribute('data-group', groupName);
    row.setAttribute('draggable', 'false');
    row.innerHTML = `
        <td>
            <span class="row-drag-handle" title="Drag to reorder">&#x28FF;</span>
            <button class="edit-button action-button" data-index="${index}">Edit</button>
            <button class="save-button action-button" data-index="${index}" style="display:none;">Save</button>
            <button class="discard-button action-button" data-index="${index}" style="display:none;">Discard</button>
            <button class="delete-button action-button" data-index="${index}">Delete</button>
        </td>
        <td>
            <div>
                <span class="search-text">${escapedSearch}</span>
                <input class="search-input" type="text" value="${escapedSearch}" style="display:none;">
            </div>
            <div>
                <span class="title-text">${escapedTitle}</span>
                <input class="title-input" type="text" value="${escapedTitle}" style="display:none;">
            </div>
            <div class="group-row" style="display:none;"></div>
        </td>
        <td style="text-align: center;">
            <label class="switch">
                <input type="checkbox" class="pattern-enabled-toggle" ${(isEnabled && !isGroupDisabled) ? 'checked' : ''} ${isGroupDisabled ? 'disabled' : ''} data-index="${index}">
                <span class="slider"></span>
            </label>
        </td>
    `;
    // Build custom dropdown for group selection in the group-row
    const groupRow = row.querySelector('.group-row');
    const customSelect = createCustomSelectElement();
    groupRow.appendChild(customSelect);
    const newGroupInput = document.createElement('input');
    newGroupInput.type = 'text';
    newGroupInput.className = 'new-group-input-row monospace-font';
    newGroupInput.placeholder = 'New group name';
    newGroupInput.style.display = 'none';
    groupRow.appendChild(newGroupInput);
    return row;
}

async function restoreOptions() {
    console.log('restoreOptions');
    try {
        let {
            loadDiscardedTabs,
            reDiscardTabs,
            discardDelay,
            groupSortOrder,
            showRecentGroupFirst,
            showGroupRuleCount,
            recentGroupSelection: storedRecentGroupSelection
        } = await browser.storage.local.get([
            'loadDiscardedTabs',
            'reDiscardTabs',
            'discardDelay',
            'groupSortOrder',
            'showRecentGroupFirst',
            'showGroupRuleCount',
            'recentGroupSelection'
        ]);

        groupSortOrderPreference = groupSortOrder || 'alphabetic';
        showRecentGroupFirstPreference = showRecentGroupFirst === true;
        showGroupRuleCountPreference = showGroupRuleCount === true;
        recentGroupSelection = storedRecentGroupSelection || '';

        // Restore persisted UI states
        const { collapsedGroups: storedCollapsed, disabledGroups: storedDisabled } = await browser.storage.local.get(['collapsedGroups', 'disabledGroups']);

        collapsedGroups.clear();
        if (Array.isArray(storedCollapsed)) storedCollapsed.forEach(g => collapsedGroups.add(g));

        disabledGroups.clear();
        if (Array.isArray(storedDisabled)) storedDisabled.forEach(g => disabledGroups.add(g));

        if (loadDiscardedTabs === undefined) {
            loadDiscardedTabs = true;
            browser.storage.local.set({ loadDiscardedTabs });
        }
        if (reDiscardTabs === undefined) {
            reDiscardTabs = true;
            browser.storage.local.set({ reDiscardTabs });
        }
        if (discardDelay === undefined) {
            discardDelay = 1;
            browser.storage.local.set({ discardDelay });
        }

        const result = await browser.storage.local.get('patterns');
        const patterns = result.patterns || [];
        const patternTableBody = document.getElementById('pattern-table').getElementsByTagName('tbody')[0];
        patternTableBody.innerHTML = '';

        // Rebuild the Group dropdown in the Add Pattern form
        buildGroupSelect(document.getElementById('group-select-wrapper'), patterns);

        if (patterns.length === 0) {
            const noValuesMessage = document.createElement('tr');
            noValuesMessage.id = 'no-values-message';
            noValuesMessage.innerHTML = '<td colspan="3">No values stored</td>';
            patternTableBody.appendChild(noValuesMessage);
        } else {
            // Separate ungrouped patterns from named groups, preserving flat-array order
            const ungrouped = [];
            const groups = new Map();  // groupName -> [{pattern, index}]
            const groupOrder = [];

            patterns.forEach((pattern, index) => {
                if (pattern.group) {
                    if (!groups.has(pattern.group)) {
                        groups.set(pattern.group, []);
                        groupOrder.push(pattern.group);
                    }
                    groups.get(pattern.group).push({ pattern, index });
                } else {
                    ungrouped.push({ pattern, index });
                }
            });

            // Render ungrouped patterns first (no header row)
            ungrouped.forEach(({ pattern, index }) => {
                patternTableBody.appendChild(createPatternRow(pattern, index, ''));
            });

            // Render each named group with a collapsible header
            for (const groupName of groupOrder) {
                const members = groups.get(groupName);
                const escapedName = escapeHTML(groupName);
                const displayedGroupName = showGroupRuleCountPreference
                    ? `${escapedName} (${members.length})`
                    : escapedName;
                const isCollapsed = collapsedGroups.has(groupName);
                const isGroupDisabled = disabledGroups.has(groupName);

                const headerRow = document.createElement('tr');
                headerRow.className = 'group-header';
                if (isGroupDisabled) headerRow.classList.add('disabled-visual');
                headerRow.setAttribute('data-group', groupName);
                headerRow.setAttribute('draggable', 'false');
                headerRow.innerHTML = `
                    <td colspan="2">
                        <div class="group-header-inner">
                            <span class="group-header-left">
                                <span class="drag-handle" title="Drag to reorder">&#x28FF;</span>
                                <span class="group-toggle ${isCollapsed ? 'collapsed' : 'expanded'}"></span>
                                <span class="group-name-text">${displayedGroupName}</span>
                            </span>
                            <span class="group-header-right">
                                <button type="button" class="rename-group-button action-button" data-group="${escapedName}">Rename</button>
                                <button type="button" class="delete-group-button action-button" data-group="${escapedName}">Delete Group</button>
                            </span>
                        </div>
                    </td>
                    <td style="text-align: center;">
                        <label class="switch" title="Enable/Disable Group">
                            <input type="checkbox" class="group-enabled-toggle" ${!isGroupDisabled ? 'checked' : ''} data-group="${escapedName}">
                            <span class="slider"></span>
                        </label>
                    </td>
                `;
                patternTableBody.appendChild(headerRow);

                members.forEach(({ pattern, index }) => {
                    const row = createPatternRow(pattern, index, groupName, isGroupDisabled);
                    if (isCollapsed) row.style.display = 'none';
                    patternTableBody.appendChild(row);
                });
            }

            // Event listeners for pattern row buttons
            document.querySelectorAll('.edit-button').forEach(button => {
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    const index = event.target.getAttribute('data-index');
                    disableButtons(index);
                    toggleEditRow(index, true);
                });
            });

            document.querySelectorAll('.save-button').forEach(button => {
                button.addEventListener('click', async (event) => {
                    event.preventDefault();
                    const index = event.target.getAttribute('data-index');
                    await saveRow(index);
                    enableButtons();
                });
            });

            document.querySelectorAll('.discard-button').forEach(button => {
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    const index = event.target.getAttribute('data-index');
                    toggleEditRow(index, false);
                    enableButtons();
                });
            });

            document.querySelectorAll('.delete-button').forEach(button => {
                button.addEventListener('click', async (event) => {
                    event.preventDefault();
                    const index = event.target.getAttribute('data-index');
                    const row = event.target.closest('tr');
                    const searchTerm = row.querySelector('.search-text').textContent;
                    
                    const dialog = document.getElementById('delete-rule-dialog');
                    const preview = document.getElementById('delete-rule-preview');
                    const confirmBtn = document.getElementById('confirm-delete-rule-btn');
                    const cancelBtn = document.getElementById('cancel-delete-rule-btn');

                    if (preview) preview.innerText = `"${searchTerm}"`;
                    
                    confirmBtn.onclick = async () => {
                        await deletePattern(index);
                        dialog.close();
                    };

                    cancelBtn.onclick = () => dialog.close();
                    
                    dialog.showModal();
                });
            });

            document.querySelectorAll('.pattern-enabled-toggle').forEach(checkbox => {
                checkbox.addEventListener('change', async (event) => {
                    const index = event.target.getAttribute('data-index');
                    const isEnabled = event.target.checked;
                    await updatePatternEnabled(index, isEnabled);
                });
            });

            document.querySelectorAll('.group-enabled-toggle').forEach(checkbox => {
                checkbox.addEventListener('change', async (event) => {
                    const groupName = event.target.getAttribute('data-group');
                    const isEnabled = event.target.checked;
                    await updateGroupDisabled(groupName, !isEnabled);
                });
            });

            // Event listeners for group header buttons
            document.querySelectorAll('.rename-group-button').forEach(button => {
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    renameGroup(event.target.getAttribute('data-group')).catch(console.error);
                });
            });

            document.querySelectorAll('.delete-group-button').forEach(button => {
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    showDeleteGroupDialog(event.target.getAttribute('data-group'));
                });
            });

            // Drag-and-drop reordering of group header rows
            // Attach dragover+drop directly to the <td> (the actual hit-test target)
            // to avoid relying on bubbling to <tbody> which is unreliable in extension popups.
            document.querySelectorAll('.group-header').forEach(headerRow => {
                const td = headerRow.querySelector('td');

                headerRow.addEventListener('dragstart', (e) => {
                    if (e.target.closest('button, input, select, textarea')) { e.preventDefault(); return; }
                    draggedGroupName = headerRow.getAttribute('data-group');
                    setTimeout(() => headerRow.classList.add('group-dragging'), 0);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', draggedGroupName);

                    const scrollContainer = document.querySelector('.patterns-table-container');
                    if (scrollContainer) handleAutoScroll(scrollContainer);
                });

                headerRow.addEventListener('dragend', () => {
                    draggedGroupName = null;
                    document.querySelectorAll('.group-header').forEach(r =>
                        r.classList.remove('group-dragging', 'drag-over-top', 'drag-over-bottom')
                    );
                    stopAutoScroll();
                });

                td.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!draggedGroupName) return;
                    const targetGroup = headerRow.getAttribute('data-group');
                    if (targetGroup === draggedGroupName) return;

                    const rect = td.getBoundingClientRect();
                    const isTopHalf = e.clientY < rect.top + rect.height / 2;
                    const isCollapsed = collapsedGroups.has(targetGroup);

                    if (!isTopHalf && !isCollapsed) {
                        e.dataTransfer.dropEffect = 'none';
                        document.querySelectorAll('.group-header').forEach(r =>
                            r.classList.remove('drag-over-top', 'drag-over-bottom')
                        );
                        return;
                    }

                    e.dataTransfer.dropEffect = 'move';
                    document.querySelectorAll('.group-header').forEach(r =>
                        r.classList.remove('drag-over-top', 'drag-over-bottom')
                    );
                    headerRow.classList.add(
                        isTopHalf ? 'drag-over-top' : 'drag-over-bottom'
                    );
                });

                td.addEventListener('dragleave', (e) => {
                    if (!td.contains(e.relatedTarget)) {
                        headerRow.classList.remove('drag-over-top', 'drag-over-bottom');
                    }
                });

                td.addEventListener('drop', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const sourceGroup = draggedGroupName;
                    const targetGroupName = headerRow.getAttribute('data-group');
                    if (!sourceGroup || targetGroupName === sourceGroup) return;

                    const rect = td.getBoundingClientRect();
                    const dropBefore = e.clientY < rect.top + rect.height / 2;
                    const isCollapsed = collapsedGroups.has(targetGroupName);

                    if (!dropBefore && !isCollapsed) return;

                    const result = await browser.storage.local.get('patterns');
                    const patterns = result.patterns || [];

                    const groupOrder = [...new Set(patterns.map(p => p.group).filter(Boolean))];
                    const ungrouped = patterns.filter(p => !p.group);

                    const newOrder = groupOrder.filter(g => g !== sourceGroup);
                    const targetIdx = newOrder.indexOf(targetGroupName);
                    newOrder.splice(dropBefore ? targetIdx : targetIdx + 1, 0, sourceGroup);

                    const newPatterns = [...ungrouped];
                    for (const g of newOrder) {
                        newPatterns.push(...patterns.filter(p => p.group === g));
                    }

                    await browser.storage.local.set({ patterns: newPatterns });
                    await restoreOptions();
                    browser.runtime.sendMessage({ action: 'rerunPatterns' });
                });
            });

            // Drag-and-drop for individual pattern rows
            let draggedPatternIndex = null;
            document.querySelectorAll('.pattern-row').forEach(patternRow => {

                patternRow.addEventListener('dragstart', (e) => {
                    if (e.target.closest('button, input, select, textarea')) { e.preventDefault(); return; }
                    draggedPatternIndex = parseInt(patternRow.getAttribute('data-index'), 10);
                    setTimeout(() => patternRow.classList.add('row-dragging'), 0);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(draggedPatternIndex));

                    const scrollContainer = document.querySelector('.patterns-table-container');
                    if (scrollContainer) handleAutoScroll(scrollContainer);
                });

                patternRow.addEventListener('dragend', () => {
                    draggedPatternIndex = null;
                    document.querySelectorAll('.pattern-row').forEach(r =>
                        r.classList.remove('row-dragging', 'row-drag-over-top', 'row-drag-over-bottom')
                    );
                    document.querySelectorAll('.group-header').forEach(r =>
                        r.classList.remove('group-drop-target')
                    );
                    stopAutoScroll();
                });

                patternRow.addEventListener('dragover', (e) => {
                    if (draggedPatternIndex === null && draggedGroupName === null) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const rect = patternRow.getBoundingClientRect();
                    const isTopHalf = e.clientY < rect.top + rect.height / 2;

                    if (draggedPatternIndex !== null) {
                        const targetIndex = parseInt(patternRow.getAttribute('data-index'), 10);
                        if (targetIndex === draggedPatternIndex) return;
                        e.dataTransfer.dropEffect = 'move';
                        document.querySelectorAll('.pattern-row').forEach(r =>
                            r.classList.remove('row-drag-over-top', 'row-drag-over-bottom')
                        );
                        patternRow.classList.add(isTopHalf ? 'row-drag-over-top' : 'row-drag-over-bottom');
                    } else if (draggedGroupName !== null) {
                        const targetGroup = patternRow.getAttribute('data-group');
                        if (!targetGroup || targetGroup === draggedGroupName) return;

                        const nextRow = patternRow.nextElementSibling;
                        const isLastInGroup = !nextRow || nextRow.getAttribute('data-group') !== targetGroup || nextRow.classList.contains('group-header');

                        if (!isLastInGroup || isTopHalf) {
                            e.dataTransfer.dropEffect = 'none';
                            document.querySelectorAll('.pattern-row, .group-header').forEach(r =>
                                r.classList.remove('row-drag-over-top', 'row-drag-over-bottom', 'drag-over-top', 'drag-over-bottom')
                            );
                            return;
                        }

                        e.dataTransfer.dropEffect = 'move';
                        document.querySelectorAll('.pattern-row, .group-header').forEach(r =>
                            r.classList.remove('row-drag-over-top', 'row-drag-over-bottom', 'drag-over-top', 'drag-over-bottom')
                        );
                        patternRow.classList.add('row-drag-over-bottom');
                    }
                });

                patternRow.addEventListener('dragleave', (e) => {
                    if (!patternRow.contains(e.relatedTarget)) {
                        patternRow.classList.remove('row-drag-over-top', 'row-drag-over-bottom');
                    }
                });

                patternRow.addEventListener('drop', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (draggedPatternIndex === null && draggedGroupName === null) return;

                    const rect = patternRow.getBoundingClientRect();
                    const dropBefore = e.clientY < rect.top + rect.height / 2;

                    if (draggedPatternIndex !== null) {
                        const sourceIndex = draggedPatternIndex;
                        const targetIndex = parseInt(patternRow.getAttribute('data-index'), 10);
                        if (targetIndex === sourceIndex) return;
                        const insertAt = dropBefore ? targetIndex : targetIndex + 1;

                        const result = await browser.storage.local.get('patterns');
                        const patterns = result.patterns || [];
                        const targetGroup = patternRow.getAttribute('data-group') || undefined;

                        const [moved] = patterns.splice(sourceIndex, 1);
                        if (targetGroup) moved.group = targetGroup;
                        else delete moved.group;

                        const adjustedInsert = sourceIndex < insertAt ? insertAt - 1 : insertAt;
                        patterns.splice(adjustedInsert, 0, moved);

                        await browser.storage.local.set({ patterns });
                        await restoreOptions();
                        browser.runtime.sendMessage({ action: 'rerunPatterns' });
                    } else if (draggedGroupName !== null) {
                        const sourceGroup = draggedGroupName;
                        const targetGroupName = patternRow.getAttribute('data-group');
                        if (!sourceGroup || targetGroupName === sourceGroup || !targetGroupName) return;

                        const nextRow = patternRow.nextElementSibling;
                        const isLastInGroup = !nextRow || nextRow.getAttribute('data-group') !== targetGroupName || nextRow.classList.contains('group-header');

                        if (!isLastInGroup || dropBefore) return;

                        const result = await browser.storage.local.get('patterns');
                        const patterns = result.patterns || [];

                        const groupOrder = [...new Set(patterns.map(p => p.group).filter(Boolean))];
                        const ungrouped = patterns.filter(p => !p.group);

                        const newOrder = groupOrder.filter(g => g !== sourceGroup);
                        const targetIdx = newOrder.indexOf(targetGroupName);
                        newOrder.splice(dropBefore ? targetIdx : targetIdx + 1, 0, sourceGroup);

                        const newPatterns = [...ungrouped];
                        for (const g of newOrder) {
                            newPatterns.push(...patterns.filter(p => p.group === g));
                        }

                        await browser.storage.local.set({ patterns: newPatterns });
                        await restoreOptions();
                        browser.runtime.sendMessage({ action: 'rerunPatterns' });
                    }
                });
            });

            // Allow dropping a pattern row onto a group header (moves it into that group, appended)
            document.querySelectorAll('.group-header').forEach(headerRow => {
                const td = headerRow.querySelector('td');
                td.addEventListener('dragover', (e) => {
                    if (draggedPatternIndex === null) return;
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'move';
                    document.querySelectorAll('.group-header').forEach(r => r.classList.remove('group-drop-target'));
                    headerRow.classList.add('group-drop-target');
                }, true);

                td.addEventListener('dragleave', (e) => {
                    if (!td.contains(e.relatedTarget)) {
                        headerRow.classList.remove('group-drop-target');
                    }
                }, true);

                td.addEventListener('drop', async (e) => {
                    if (draggedPatternIndex === null) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const sourceIndex = draggedPatternIndex;
                    const targetGroupName = headerRow.getAttribute('data-group');

                    const result = await browser.storage.local.get('patterns');
                    const patterns = result.patterns || [];
                    const [moved] = patterns.splice(sourceIndex, 1);
                    moved.group = targetGroupName;
                    // Find last member of target group in post-splice array and insert after it.
                    // If the group has no other members, append to end of array.
                    const lastInGroup = patterns.reduce((last, p, i) => p.group === targetGroupName ? i : last, -1);
                    patterns.splice(lastInGroup === -1 ? patterns.length : lastInGroup + 1, 0, moved);

                    await browser.storage.local.set({ patterns });
                    await restoreOptions();
                }, true);
            });
        }
    } catch (error) {
        console.error('Error restoring options:', error);
    }
}

function disableButtons(exceptIndex) {
    const buttons = document.querySelectorAll('button.action-button');
    buttons.forEach(button => {
        const index = button.getAttribute('data-index');
        if (index !== exceptIndex && !button.classList.contains('notes-examples-button')) {
            button.disabled = true;
        }
    });
    const addPatternButton = document.getElementById('add-pattern-button');
    if (addPatternButton) {
        //addPatternButton.disabled = true;
        addPatternButton.setAttribute('disabled', 'true');
    }
}

function enableButtons() {
    const buttons = document.querySelectorAll('button.action-button');
    buttons.forEach(button => {
        button.disabled = false;
    });
    const addPatternButton = document.getElementById('add-pattern-button');
    if (addPatternButton) {
        addPatternButton.disabled = false;
    }
}

function toggleEditRow(index, isEditing) {
    console.log('toggleEditRow');
    const table = document.getElementById('pattern-table');
    const row = document.querySelector(`#pattern-table tbody tr[data-index="${index}"]`);
    if (!row) {
        console.error(`Row with index ${index} not found`);
        return;
    }
    const searchText = row.querySelector('.search-text');
    const searchInput = row.querySelector('.search-input');
    const titleText = row.querySelector('.title-text');
    const titleInput = row.querySelector('.title-input');
    const groupRow = row.querySelector('.group-row');
    const groupSelectWrapper = row.querySelector('.custom-select');
    const groupSelectInput = row.querySelector('.group-select-input');
    const searchCell = searchInput.closest('td'); // Select the cell containing searchInput
    const titleCell = titleInput.closest('td'); // Select the cell containing titleInput
    const editButton = row.querySelector('.edit-button');
    const saveButton = row.querySelector('.save-button');
    const discardButton = row.querySelector('.discard-button');
    const deleteButton = row.querySelector('.delete-button');

    if (isEditing) {
        table.classList.add('edit-mode'); // Add edit-mode class
        searchText.style.display = 'none';
        searchInput.style.display = 'inline';
        searchCell.classList.add('no-margin'); // Add no-margin class to the search cell
        titleText.style.display = 'none';
        titleInput.style.display = 'inline';
        titleCell.classList.add('no-margin'); // Add no-margin class to the title cell
        // Show group selector row and populate it
        groupRow.style.display = 'flex';
        browser.storage.local.get('patterns').then(result => {
            const patterns = result.patterns || [];
            const currentGroup = row.getAttribute('data-group') || '';
            buildGroupSelect(groupSelectWrapper, patterns, currentGroup);
        });
        editButton.style.display = 'none';
        saveButton.style.display = 'inline';
        discardButton.style.display = 'inline';
        deleteButton.style.display = 'none';

        // Smoothly scroll the row into view to ensure the newly revealed 
        // group dropdown is visible, especially for rows near the bottom.
        setTimeout(() => {
            row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
    } else {
        // Revert any unsaved input back to the original text
        searchInput.value = searchText.textContent;
        titleInput.value = titleText.textContent;
        const newGroupInput = row.querySelector('.new-group-input-row');
        if (newGroupInput) newGroupInput.value = '';

        table.classList.remove('edit-mode'); // Remove edit-mode class
        searchText.style.display = 'inline';
        searchInput.style.display = 'none';
        searchCell.classList.remove('no-margin'); // Remove no-margin class from the search cell
        titleText.style.display = 'inline';
        titleInput.style.display = 'none';
        titleCell.classList.remove('no-margin'); // Remove no-margin class from the title cell
        // Hide group selector row
        groupRow.style.display = 'none';
        row.querySelector('.new-group-input-row').style.display = 'none';
        editButton.style.display = 'inline';
        saveButton.style.display = 'none';
        discardButton.style.display = 'none';
        deleteButton.style.display = 'inline';
    }
}

async function saveRow(index) {
    console.log('saveRow');
    const row = document.querySelector(`#pattern-table tbody tr[data-index="${index}"]`);
    if (!row) {
        console.error(`Row with index ${index} not found`);
        return;
    }
    const searchInput = row.querySelector('.search-input').value;
    const titleInput = row.querySelector('.title-input').value;
    const groupValue = getGroupSelectValue(
        row.querySelector('.custom-select'),
        row.querySelector('.new-group-input-row')
    );

    try {
        const result = await browser.storage.local.get('patterns');
        const patterns = result.patterns || [];
        const storageUpdate = optionsMutationHelpers.buildSaveRowUpdate(patterns, index, {
            search: searchInput,
            title: titleInput,
            groupValue,
        });
        await browser.storage.local.set(storageUpdate);
        if (storageUpdate.recentGroupSelection) {
            recentGroupSelection = storageUpdate.recentGroupSelection;
        }
        await restoreOptions(); // Refresh the list after saving

        // The background script automatically syncs tabs via storage listener
    } catch (error) {
        console.error('Error saving row:', error);
    }
}

async function deletePattern(index) {
    console.log('deletePattern');
    try {
        const result = await browser.storage.local.get('patterns');
        const patterns = result.patterns || [];
        patterns.splice(index, 1);
        await browser.storage.local.set({ patterns });
        await restoreOptions(); // Refresh the list after deletion
    } catch (error) {
        console.error('Error deleting pattern:', error);
    }
}

// Function to update tab title based on stored search patterns
/*
async function updateTabTitle(tabId, changeInfo, tab) {
    if (changeInfo.title || changeInfo.url) {
        try {
            const result = await browser.storage.local.get('patterns');
            const patterns = result.patterns || [];
            for (const pattern of patterns) {
                try {
                    const regex = new RegExp(pattern.search);
                    const matches = tab.url.match(regex);
                    if (matches) {
                        console.log('Matches:', matches);
                        const newTitle = pattern.title.replace(/\$(\d+)/g, (match, number) => {
                            return matches[number] || match;
                        });
                        
                        let wasDiscarded = false;
                        const tab = await browser.tabs.get(tabId);
                        if (tab.discarded) {
                            wasDiscarded = true;
                            await browser.tabs.update(tabId, { active: true });
                        }

                        await browser.tabs.executeScript(tabId, {
                            code: `document.title = "${newTitle}";`
                        });

                        if (wasDiscarded) {
                            await browser.tabs.discard(tabId);
                        }
                        break;
                    }
                } catch (e) {
                    console.error(`Invalid search pattern: ${pattern.search}`, e);
                }
            }
        } catch (error) {
            console.error('Error accessing storage:', error);
        }
    }
}
*/

async function updatePatternEnabled(index, isEnabled) {
    const result = await browser.storage.local.get('patterns');
    const patterns = result.patterns || [];
    const storageUpdate = optionsMutationHelpers.buildPatternEnabledUpdate(patterns, index, isEnabled);

    if (storageUpdate.patterns[index]) {
        await browser.storage.local.set(storageUpdate);

        // Update visual state of the row
        const row = document.querySelector(`.pattern-row[data-index="${index}"]`);
        if (row) {
            const groupName = row.getAttribute('data-group');
            const isGroupDisabled = disabledGroups.has(groupName);
            if (!isEnabled || isGroupDisabled) {
                row.classList.add('disabled-visual');
            } else {
                row.classList.remove('disabled-visual');
            }
        }
    }
}

async function updateGroupDisabled(groupName, isDisabled) {
    const nextDisabledGroups = optionsMutationHelpers.buildDisabledGroupsUpdate(disabledGroups, groupName, isDisabled);
    disabledGroups.clear();
    nextDisabledGroups.forEach(group => disabledGroups.add(group));

    await browser.storage.local.set({ disabledGroups: nextDisabledGroups });

    // Update visual state of the group header and its child rows
    const headerRow = document.querySelector(`.group-header[data-group="${CSS.escape(groupName)}"]`);
    if (headerRow) {
        if (isDisabled) {
            headerRow.classList.add('disabled-visual');
        } else {
            headerRow.classList.remove('disabled-visual');
        }
    }

    // Update all pattern rows in this group
    const rows = document.querySelectorAll(`.pattern-row[data-group="${CSS.escape(groupName)}"]`);
    const { patterns } = await browser.storage.local.get('patterns');
    for (const row of rows) {
        const index = row.getAttribute('data-index');
        const isPatternEnabled = patterns[index] ? patterns[index].enabled !== false : true;

        const checkbox = row.querySelector('.pattern-enabled-toggle');
        if (isDisabled || !isPatternEnabled) {
            row.classList.add('disabled-visual');
        } else {
            row.classList.remove('disabled-visual');
        }

        if (checkbox) {
            checkbox.checked = isPatternEnabled && !isDisabled;
            checkbox.disabled = isDisabled;
        }
    }
}

function openNotes() {
    console.log('openNotes');
    // Point to the GitHub repo as the central hub for Features, Roadmap, and Examples
    window.open('https://github.com/irvinm/Title-Tamer#features', '_blank');
}