document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMContentLoaded');
    await restoreOptions().catch(console.error);

    document.getElementById('pattern-form').addEventListener('submit', (event) => {
        event.preventDefault(); // Prevent the form from submitting
        savePattern(event).catch(console.error);
    });

    document.getElementById('notes-button').addEventListener('click', openNotes);

    const toggleButton = document.getElementById('toggle-options');
    const collapsibleContent = document.getElementById('additional-options');

    toggleButton.addEventListener('click', () => {
        if (collapsibleContent.style.display === 'none' || collapsibleContent.style.display === '') {
            collapsibleContent.style.display = 'block';
            toggleButton.classList.remove('collapsed');
            toggleButton.classList.add('expanded');
        } else {
            collapsibleContent.style.display = 'none';
            toggleButton.classList.remove('expanded');
            toggleButton.classList.add('collapsed');
        }
    });

    // Initialize the arrow direction
    toggleButton.classList.add('collapsed');

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

    document.getElementById('load-discarded-tabs').checked = loadDiscardedTabs;
    document.getElementById('re-discard-tabs').checked = reDiscardTabs;
    document.getElementById('discard-delay').value = discardDelay;

    // Show or hide re-discard options based on loadDiscardedTabs state
    document.getElementById('re-discard-options').style.display = loadDiscardedTabs ? 'block' : 'none';

    document.getElementById('load-discarded-tabs').addEventListener('change', function() {
        const loadDiscardedTabs = this.checked;
        browser.storage.local.set({ loadDiscardedTabs });
        document.getElementById('re-discard-options').style.display = loadDiscardedTabs ? 'block' : 'none';
    });

    document.getElementById('re-discard-tabs').addEventListener('change', function() {
        const reDiscardTabs = this.checked;
        browser.storage.local.set({ reDiscardTabs });
    });

    document.getElementById('discard-delay').addEventListener('input', function() {
        const discardDelay = parseInt(this.value, 10) || 1;
        browser.storage.local.set({ discardDelay });
    });

    const table = document.getElementById('pattern-table');
    table.addEventListener('click', (event) => {
        event.preventDefault();
        if (event.target.classList.contains('move-up-button')) {
            moveRow(event.target.closest('tr'), 'up');
        } else if (event.target.classList.contains('move-down-button')) {
            moveRow(event.target.closest('tr'), 'down');
        }
    });
});

async function savePattern(event) {
    console.log('savePattern');
    const search = document.getElementById('search').value; // Updated ID
    const title = document.getElementById('title').value;

    try {
        const result = await browser.storage.local.get('patterns');
        const patterns = result.patterns || [];
        patterns.push({ search, title }); // Include the dropdown value
        await browser.storage.local.set({ patterns });
        await restoreOptions(); // Load and display all existing search-title-type pairs

        // Clear the input fields
        document.getElementById('search').value = '';
        document.getElementById('title').value = '';

        // Send a message to the background script to update the tabs
        browser.runtime.sendMessage({ action: 'newPattern', pattern: { search, title } });
    } catch (error) {
        console.error('Error saving pattern:', error);
    }
}

async function restoreOptions() {
    console.log('restoreOptions');
    try {
        // Check if the loadDiscardedTabs, reDiscardTabs, and discardDelay values are stored
        let { loadDiscardedTabs, reDiscardTabs, discardDelay } = await browser.storage.local.get(['loadDiscardedTabs', 'reDiscardTabs', 'discardDelay']);
        
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

        if (patterns.length === 0) {
            const noValuesMessage = document.createElement('tr');
            noValuesMessage.id = 'no-values-message';
            noValuesMessage.innerHTML = '<td colspan="4">No values stored</td>'; // Update colspan to 4
            patternTableBody.appendChild(noValuesMessage);
        } else {
            patterns.forEach((pattern, index) => {
                const row = document.createElement('tr');
                row.setAttribute('data-index', index);
                row.innerHTML = `
                    <td>
                        <button class="edit-button action-button" data-index="${index}">Edit</button>
                        <button class="save-button action-button" data-index="${index}" style="display:none;">Save</button>
                        <button class="discard-button action-button" data-index="${index}" style="display:none;">Discard</button>
                        <button class="delete-button action-button" data-index="${index}">Delete</button>
                    </td>    
                    <td>
                        <div>
                            <span class="search-text">${pattern.search}</span>
                            <input class="search-input" type="text" value="${pattern.search}" style="display:none;">
                        </div>
                        <div>
                            <span class="title-text">${pattern.title}</span>
                            <input class="title-input" type="text" value="${pattern.title}" style="display:none;">
                        </div>
                    </td>
                    <td>
                        <button class="move-up-button move-button">Up</button>
                        <button class="move-down-button move-button">Down</button>
                    </td>
                `;
                patternTableBody.appendChild(row);
            });

            // Add event listeners for edit, save, discard, and delete buttons
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
        editButton.style.display = 'none';
        saveButton.style.display = 'inline';
        discardButton.style.display = 'inline';
        deleteButton.style.display = 'none';
    } else {
        table.classList.remove('edit-mode'); // Remove edit-mode class
        searchText.style.display = 'inline';
        searchInput.style.display = 'none';
        searchCell.classList.remove('no-margin'); // Remove no-margin class from the search cell
        titleText.style.display = 'inline';
        titleInput.style.display = 'none';
        titleCell.classList.remove('no-margin'); // Remove no-margin class from the title cell
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

    try {
        const result = await browser.storage.local.get('patterns');
        const patterns = result.patterns || [];
        patterns[index] = { search: searchInput, title: titleInput };
        await browser.storage.local.set({ patterns });
        await restoreOptions(); // Refresh the list after saving

        // Reapply search rules to all open tabs
        /*
        const tabs = await browser.tabs.query({});
        for (const tab of tabs) {
            updateTabTitle(tab.id, { title: tab.title, url: tab.url }, tab);
        }
        */

        // Send a message to the background script with the new search/title/type pair
        /* browser.runtime.sendMessage({ action: 'newPattern', pattern: { search, title, type } }); */
        browser.runtime.sendMessage({ action: 'newPattern', pattern: patterns[index] });
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

function openNotes() {
    console.log('openNotes');
    window.open('note.html', '_blank');
}

async function moveRow(row, direction) {
    const index = parseInt(row.getAttribute('data-index'), 10);
    const result = await browser.storage.local.get('patterns');
    const patterns = result.patterns || [];

    if (direction === 'up' && index > 0) {
        // Swap patterns in the array
        [patterns[index - 1], patterns[index]] = [patterns[index], patterns[index - 1]];
    } else if (direction === 'down' && index < patterns.length - 1) {
        // Swap patterns in the array
        [patterns[index + 1], patterns[index]] = [patterns[index], patterns[index + 1]];
    }

    // Store the updated patterns array
    await browser.storage.local.set({ patterns });

    // Refresh the UI
    await restoreOptions();

    // Send a message to background.js to rerun the patterns
    browser.runtime.sendMessage({ action: 'rerunPatterns' });
}