document.addEventListener('DOMContentLoaded', () => {
    restoreOptions().catch(console.error);
    document.getElementById('pattern-form').addEventListener('submit', (event) => {
        savePattern(event).catch(console.error);
    });
});

async function savePattern(event) {
    event.preventDefault();
    const regex = document.getElementById('regex').value;
    const title = document.getElementById('title').value;

    try {
        const result = await browser.storage.local.get('patterns');
        const patterns = result.patterns || [];
        patterns.push({ regex, title });
        await browser.storage.local.set({ patterns });
        await restoreOptions(); // Load and display all existing regex-title pairs

        // Clear the input fields
        document.getElementById('pattern-form').reset();

        // Send a message to the background script with the new regex/title pair
        browser.runtime.sendMessage({ action: 'newPattern', pattern: { regex, title } });
    } catch (error) {
        console.error('Error saving pattern:', error);
    }
}

async function restoreOptions() {
    try {
        const result = await browser.storage.local.get('patterns');
        const patterns = result.patterns || [];
        const patternTableBody = document.getElementById('pattern-table').getElementsByTagName('tbody')[0];
        patternTableBody.innerHTML = '';

        if (patterns.length === 0) {
            const noValuesMessage = document.createElement('tr');
            noValuesMessage.id = 'no-values-message';
            noValuesMessage.innerHTML = '<td colspan="2">No values stored</td>';
            patternTableBody.appendChild(noValuesMessage);
        } else {
            patterns.forEach((pattern, index) => {
                const row = document.createElement('tr');
                row.setAttribute('data-index', index);
                row.innerHTML = `
                    <td>
                        <div>
                            <span class="regex-text"><strong>${pattern.regex}</strong></span>
                            <input class="regex-input" type="text" value="${pattern.regex}" style="display:none;">
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
    const row = document.querySelector(`#pattern-table tbody tr[data-index="${index}"]`);
    if (!row) {
        console.error(`Row with index ${index} not found`);
        return;
    }
    const regexText = row.querySelector('.regex-text');
    const regexInput = row.querySelector('.regex-input');
    const titleText = row.querySelector('.title-text');
    const titleInput = row.querySelector('.title-input');
    const editButton = row.querySelector('.edit-button');
    const saveButton = row.querySelector('.save-button');
    const discardButton = row.querySelector('.discard-button');
    const deleteButton = row.querySelector('.delete-button');

    if (isEditing) {
        regexText.style.display = 'none';
        regexInput.style.display = 'inline';
        titleText.style.display = 'none';
        titleInput.style.display = 'inline';
        editButton.style.display = 'none';
        saveButton.style.display = 'inline';
        discardButton.style.display = 'inline';
        deleteButton.style.display = 'none';
    } else {
        regexText.style.display = 'inline';
        regexInput.style.display = 'none';
        titleText.style.display = 'inline';
        titleInput.style.display = 'none';
        editButton.style.display = 'inline';
        saveButton.style.display = 'none';
        discardButton.style.display = 'none';
        deleteButton.style.display = 'inline';
    }
}

async function saveRow(index) {
    const row = document.querySelector(`#pattern-table tbody tr[data-index="${index}"]`);
    if (!row) {
        console.error(`Row with index ${index} not found`);
        return;
    }
    const regexInput = row.querySelector('.regex-input').value;
    const titleInput = row.querySelector('.title-input').value;

    try {
        const result = await browser.storage.local.get('patterns');
        const patterns = result.patterns || [];
        patterns[index] = { regex: regexInput, title: titleInput };
        await browser.storage.local.set({ patterns });
        await restoreOptions(); // Refresh the list after saving

        // Reapply regex rules to all open tabs
        const tabs = await browser.tabs.query({});
        for (const tab of tabs) {
            updateTabTitle(tab.id, { title: tab.title, url: tab.url }, tab);
        }
    } catch (error) {
        console.error('Error saving row:', error);
    }
}

async function deletePattern(index) {
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

// Function to update tab title based on stored REGEX patterns
async function updateTabTitle(tabId, changeInfo, tab) {
    if (changeInfo.title || changeInfo.url) {
        try {
            const result = await browser.storage.local.get('patterns');
            const patterns = result.patterns || [];
            for (const pattern of patterns) {
                try {
                    const regex = new RegExp(pattern.regex);
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
                    console.error(`Invalid regex pattern: ${pattern.regex}`, e);
                }
            }
        } catch (error) {
            console.error('Error accessing storage:', error);
        }
    }
}