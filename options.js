document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded');
    restoreOptions().catch(console.error);
    document.getElementById('pattern-form').addEventListener('submit', (event) => {
        savePattern(event).catch(console.error);
    });
    document.getElementById('match-type').addEventListener('change', function() {
        var matchType = this.value;
        // Handle the selection change
        console.log('Selected match type:', matchType);
    });
    document.getElementById('notes-button').addEventListener('click', openNotes);
});

async function savePattern(event) {
    console.log('savePattern');
    const search = document.getElementById('search').value; // Updated ID
    const title = document.getElementById('title').value;
    const type = document.getElementById('match-type').value; // Collect the dropdown value

    try {
        const result = await browser.storage.local.get('patterns');
        const patterns = result.patterns || [];
        patterns.push({ search, title, type }); // Include the dropdown value
        await browser.storage.local.set({ patterns });
        await restoreOptions(); // Load and display all existing search-title-type pairs

        // Clear the input fields
        document.getElementById('pattern-form').reset();

        // Send a message to the background script with the new search/title/type pair
        browser.runtime.sendMessage({ action: 'newPattern', pattern: { search, title, type } });
    } catch (error) {
        console.error('Error saving pattern:', error);
    }
}

async function restoreOptions() {
    console.log('restoreOptions');
    try {
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
                        <span class="type-text">${pattern.type}</span>
                        <select class="type-select" style="display:none;">
                            <option value="Exact" ${pattern.type === 'Exact' ? 'selected' : ''}>Exact</option>
                            <option value="Contains" ${pattern.type === 'Contains' ? 'selected' : ''}>Contains</option>
                            <option value="Regx" ${pattern.type === 'RegEx' ? 'selected' : ''}>RegEx</option>
                        </select>
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
                        <button class="edit-button" data-index="${index}">Edit</button>
                        <button class="save-button" data-index="${index}" style="display:none;">Save</button>
                        <button class="discard-button" data-index="${index}" style="display:none;">Discard</button>
                        <button class="delete-button" data-index="${index}">Delete</button>
                    </td>
                `;
                patternTableBody.appendChild(row);
            });

            // Add event listeners for edit, save, discard, and delete buttons
            document.querySelectorAll('.edit-button').forEach(button => {
                button.addEventListener('click', (event) => {
                    const index = event.target.getAttribute('data-index');
                    toggleEditRow(index, true);
                });
            });

            document.querySelectorAll('.save-button').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const index = event.target.getAttribute('data-index');
                    await saveRow(index);
                });
            });

            document.querySelectorAll('.discard-button').forEach(button => {
                button.addEventListener('click', (event) => {
                    const index = event.target.getAttribute('data-index');
                    toggleEditRow(index, false);
                });
            });

            document.querySelectorAll('.delete-button').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const index = event.target.getAttribute('data-index');
                    await deletePattern(index);
                });
            });
        }
    } catch (error) {
        console.error('Error restoring options:', error);
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
    const typeText = row.querySelector('.type-text');
    const typeSelect = row.querySelector('.type-select');
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
        typeText.style.display = 'none';
        typeSelect.style.display = 'inline';
        typeSelect.classList.add('narrow'); // Add narrow class to typeSelect
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
        typeText.style.display = 'inline';
        typeSelect.style.display = 'none';
        typeSelect.classList.remove('narrow'); // Remove narrow class from typeSelect
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
    const typeSelect = row.querySelector('.type-select').value;

    try {
        const result = await browser.storage.local.get('patterns');
        const patterns = result.patterns || [];
        patterns[index] = { search: searchInput, title: titleInput, type: typeSelect };
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