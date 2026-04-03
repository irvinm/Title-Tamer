const collapsedGroups = new Set();
const disabledGroups = new Set();
let draggedGroupName = null;

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
    const { loadDiscardedTabs, reDiscardTabs, discardDelay } = await browser.storage.local.get(['loadDiscardedTabs', 'reDiscardTabs', 'discardDelay']);

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
        const discardDelay = parseInt(this.value, 10) || 1;
        browser.storage.local.set({ discardDelay });
    });

    const table = document.getElementById('pattern-table');
    const tableContainer = document.querySelector('.patterns-table-container');
    setupFirefoxOverlayScrollbar(tableContainer);

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

    table.addEventListener('change', (event) => {
        if (event.target.classList.contains('group-select-input')) {
            const row = event.target.closest('tr');
            const newGroupInput = row.querySelector('.new-group-input-row');
            if (newGroupInput) {
                newGroupInput.style.display = event.target.value === '__new__' ? 'inline-block' : 'none';
                if (event.target.value === '__new__') newGroupInput.focus();
            }
        }
    });

    document.getElementById('group-select').addEventListener('change', function () {
        const newGroupInput = document.getElementById('new-group-input');
        newGroupInput.style.display = this.value === '__new__' ? 'inline-block' : 'none';
        if (this.value === '__new__') newGroupInput.focus();
    });

    document.getElementById('import-export-button').addEventListener('click', () => {
        window.open('../import-export/import-export.html', '_blank');
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
        document.getElementById('group-select'),
        document.getElementById('new-group-input')
    );

    try {
        const result = await browser.storage.local.get('patterns');
        const patterns = result.patterns || [];
        const pattern = { search, title };
        if (groupValue) pattern.group = groupValue;
        patterns.push(pattern);
        await browser.storage.local.set({ patterns });
        await restoreOptions();

        // Clear the input fields
        document.getElementById('search').value = '';
        document.getElementById('title').value = '';
        document.getElementById('group-select').value = '';
        document.getElementById('new-group-input').style.display = 'none';
        document.getElementById('new-group-input').value = '';

        // Send a message to the background script to update the tabs
        browser.runtime.sendMessage({ action: 'newPattern', pattern });
    } catch (error) {
        console.error('Error saving pattern:', error);
    }
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Populate a <select> element with (No group), existing group names, and New group…
function buildGroupSelect(selectEl, patterns, selectedGroup) {
    const groupNames = [...new Set(patterns.map(p => p.group).filter(Boolean))].sort();
    const prevVal = selectEl.value;
    selectEl.innerHTML = '';

    const noGroupOpt = document.createElement('option');
    noGroupOpt.value = '';
    noGroupOpt.textContent = '(No group)';
    selectEl.appendChild(noGroupOpt);

    for (const name of groupNames) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        selectEl.appendChild(opt);
    }

    const newOpt = document.createElement('option');
    newOpt.value = '__new__';
    newOpt.textContent = 'New group\u2026';
    selectEl.appendChild(newOpt);

    if (selectedGroup !== undefined) {
        selectEl.value = (selectedGroup && groupNames.includes(selectedGroup)) ? selectedGroup : '';
    } else {
        selectEl.value = prevVal;
        if (!selectEl.value) selectEl.value = '';
    }
}

// Read resolved group value from a select + companion new-name input
function getGroupSelectValue(selectEl, newInputEl) {
    if (!selectEl) return '';
    if (selectEl.value === '__new__') {
        return newInputEl ? newInputEl.value.trim() : '';
    }
    return selectEl.value;
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
            <div class="group-row" style="display:none;">
                <select class="group-select-input"></select>
                <input class="new-group-input-row" type="text" placeholder="New group name" style="display:none;">
            </div>
        </td>
        <td style="text-align: center;">
            <label class="switch">
                <input type="checkbox" class="pattern-enabled-toggle" ${(isEnabled && !isGroupDisabled) ? 'checked' : ''} ${isGroupDisabled ? 'disabled' : ''} data-index="${index}">
                <span class="slider"></span>
            </label>
        </td>
    `;
    return row;
}

async function restoreOptions() {
    console.log('restoreOptions');
    try {
        let { loadDiscardedTabs, reDiscardTabs, discardDelay } = await browser.storage.local.get(['loadDiscardedTabs', 'reDiscardTabs', 'discardDelay']);

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
        buildGroupSelect(document.getElementById('group-select'), patterns);

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
                                <span class="group-name-text">${escapedName}</span>
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
                    await deletePattern(index);
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
                });

                headerRow.addEventListener('dragend', () => {
                    draggedGroupName = null;
                    document.querySelectorAll('.group-header').forEach(r =>
                        r.classList.remove('group-dragging', 'drag-over-top', 'drag-over-bottom')
                    );
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
                });

                patternRow.addEventListener('dragend', () => {
                    draggedPatternIndex = null;
                    document.querySelectorAll('.pattern-row').forEach(r =>
                        r.classList.remove('row-dragging', 'row-drag-over-top', 'row-drag-over-bottom')
                    );
                    document.querySelectorAll('.group-header').forEach(r =>
                        r.classList.remove('group-drop-target')
                    );
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
                    browser.runtime.sendMessage({ action: 'rerunPatterns' });
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
        searchInput.style.height = '1.5em'; // Set the height of the input
        searchCell.classList.add('no-margin'); // Add no-margin class to the search cell
        titleText.style.display = 'none';
        titleInput.style.display = 'inline';
        titleInput.style.height = '1.5em'; // Set the height of the input
        titleCell.classList.add('no-margin'); // Add no-margin class to the title cell
        // Show group selector row and populate it
        groupRow.style.display = 'flex';
        browser.storage.local.get('patterns').then(result => {
            const patterns = result.patterns || [];
            const currentGroup = row.getAttribute('data-group') || '';
            buildGroupSelect(groupSelectInput, patterns, currentGroup);
        });
        editButton.style.display = 'none';
        saveButton.style.display = 'inline';
        discardButton.style.display = 'inline';
        deleteButton.style.display = 'none';
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
        row.querySelector('.group-select-input'),
        row.querySelector('.new-group-input-row')
    );

    try {
        const result = await browser.storage.local.get('patterns');
        const patterns = result.patterns || [];
        const oldGroup = patterns[index].group || '';
        const newGroup = groupValue;
        const pattern = {
            search: searchInput,
            title: titleInput,
            enabled: patterns[index].enabled !== false // Preserve existing status
        };
        if (newGroup) pattern.group = newGroup;

        if (newGroup !== oldGroup) {
            // Remove pattern from its current position, then re-insert it
            // adjacent to other members of the new group so the group order
            // in the flat array (and thus the rendered order) is preserved.
            patterns.splice(index, 1);
            let insertAt = -1;
            for (let i = 0; i < patterns.length; i++) {
                if ((patterns[i].group || '') === newGroup) insertAt = i;
            }
            if (insertAt === -1) {
                // New group name — append at end
                patterns.push(pattern);
            } else {
                patterns.splice(insertAt + 1, 0, pattern);
            }
        } else {
            patterns[index] = pattern;
        }

        await browser.storage.local.set({ patterns });
        await restoreOptions(); // Refresh the list after saving

        browser.runtime.sendMessage({ action: 'newPattern', pattern });
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
    if (patterns[index]) {
        patterns[index].enabled = isEnabled;
        await browser.storage.local.set({ patterns });

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
    if (isDisabled) {
        disabledGroups.add(groupName);
    } else {
        disabledGroups.delete(groupName);
    }
    await browser.storage.local.set({ disabledGroups: Array.from(disabledGroups) });

    // Update visual state of the group header and its child rows
    const headerRow = document.querySelector(`.group-header[data-group="${groupName}"]`);
    if (headerRow) {
        if (isDisabled) {
            headerRow.classList.add('disabled-visual');
        } else {
            headerRow.classList.remove('disabled-visual');
        }
    }

    // Update all pattern rows in this group
    const rows = document.querySelectorAll(`.pattern-row[data-group="${groupName}"]`);
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
    window.open('../notes/note.html', '_blank');
}