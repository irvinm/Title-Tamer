const importExportHelpers = {
    buildExportPayload: globalThis.buildExportPayload || ((patterns, collapsedGroups = [], disabledGroups = []) => {
        const groupOrder = [...new Set(patterns.map(p => p.group).filter(Boolean))];
        const sorted = [...patterns.filter(p => !p.group)];
        for (const groupName of groupOrder) {
            sorted.push(...patterns.filter(p => p.group === groupName));
        }
        return {
            metadata: {
                version: '1.0',
                collapsedGroups,
                disabledGroups,
            },
            patterns: sorted,
        };
    }),
    normalizeImportPayload: globalThis.normalizeImportPayload || ((payload) => {
        const rawPatterns = Array.isArray(payload) ? payload : payload.patterns || [];
        const groupOrder = [...new Set(rawPatterns.map(p => p.group).filter(Boolean))];
        const patterns = [...rawPatterns.filter(p => !p.group)];
        for (const groupName of groupOrder) {
            patterns.push(...rawPatterns.filter(p => p.group === groupName));
        }

        const importedCollapsedGroups = payload.metadata?.collapsedGroups || [];
        const importedDisabledGroups = payload.metadata?.disabledGroups || [];
        const activeSet = new Set(groupOrder);

        return {
            patterns,
            collapsedGroups: importedCollapsedGroups.filter(g => activeSet.has(g)),
            disabledGroups: importedDisabledGroups.filter(g => activeSet.has(g)),
        };
    }),
};

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
            const exportData = importExportHelpers.buildExportPayload(rawPatterns, collapsedGroups, disabledGroups);

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
                } = importExportHelpers.normalizeImportPayload(parsedData);
    
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