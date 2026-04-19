function showCustomAlert(lines) {
    const customAlert = document.getElementById('custom-alert');
    const customAlertMessage = document.getElementById('custom-alert-message');
    const customAlertOk = document.getElementById('custom-alert-ok');

    if (!customAlert || !customAlertMessage || !customAlertOk) {
        console.error('Custom alert elements not found');
        return;
    }

    customAlertMessage.textContent = '';
    lines.forEach(line => {
        const paragraph = document.createElement('p');
        paragraph.textContent = line;
        customAlertMessage.appendChild(paragraph);
    });
    
    if (typeof customAlert.showModal === 'function') {
        customAlert.showModal();
    } else {
        customAlert.style.display = 'block';
    }

    customAlertOk.onclick = function() {
        if (typeof customAlert.close === 'function') {
            customAlert.close();
        } else {
            customAlert.style.display = 'none';
        }
    };

    // Optional: Close on backdrop click
    customAlert.onclick = function(event) {
        if (event.target === customAlert) {
            if (typeof customAlert.close === 'function') {
                customAlert.close();
            } else {
                customAlert.style.display = 'none';
            }
        }
    };
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('export-button').addEventListener('click', async function() {
        try {
            // Fetch the patterns and titles from storage (assuming browser.storage.local)
            const result = await browser.storage.local.get('patterns');
            const rawPatterns = result.patterns || [];
            if (rawPatterns.length === 0) {
                showCustomAlert(['No patterns to export.']);
                return;
            }

            // Generate filename with current date and time
            const now = new Date();
            const dateTime = now.toISOString().replace(/[:.]/g, '-'); // Replace colons and dots to make it a valid filename
            const filename = `patterns(${dateTime}).json`;

            const { collapsedGroups = [], disabledGroups = [] } = await browser.storage.local.get(['collapsedGroups', 'disabledGroups']);
            const exportData = globalThis.buildExportPayload(rawPatterns, collapsedGroups, disabledGroups);

            // Create a blob with the patterns data
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });

            // Create a link element and trigger the download
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showCustomAlert([
                `${exportData.patterns.length} patterns exported successfully!`,
                `Saved as: ${filename}`,
                `Saved to: Default download directory`
            ]);
        } catch (error) {
            console.error('Error exporting patterns:', error);
        }
    });

    document.getElementById('import-button').addEventListener('click', function() {
        const fileInput = document.getElementById('import-file');
        fileInput.click();
    
        fileInput.onchange = async function() {
            const file = fileInput.files[0];
            if (!file) {
                showCustomAlert(['No file selected.']);
                return;
            }
    
            try {
                const text = await file.text();
                const parsedData = JSON.parse(text);
                const {
                    patterns,
                    collapsedGroups,
                    disabledGroups,
                } = globalThis.normalizeImportPayload(parsedData);
    
                if (!patterns || patterns.length === 0) {
                    showCustomAlert(['Import failed: The selected file contains no patterns.', 'Existing patterns were not overwritten.']);
                    return;
                }

                // Save patterns and UI active states to storage
                await browser.storage.local.set({ patterns, collapsedGroups, disabledGroups });
    
                showCustomAlert([
                    `${patterns.length} patterns imported successfully!`,
                    `Filename: ${file.name}`
                ]);

                // The background script automatically syncs tabs via storage listener
            } catch (error) {
                console.error('Error parsing JSON:', error);
                showCustomAlert(['Failed to import patterns.', 'Invalid JSON format.']);
            }
        };
    });
});