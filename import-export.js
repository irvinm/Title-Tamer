function showCustomAlert(lines) {
    const customAlert = document.getElementById('custom-alert');
    const customAlertMessage = document.getElementById('custom-alert-message');
    const customAlertClose = document.querySelector('.custom-alert-close');

    customAlertMessage.innerHTML = lines.map(line => `<p>${line}</p>`).join('');
    customAlert.style.display = 'block';

    customAlertClose.onclick = function() {
        customAlert.style.display = 'none';
    };

    window.onclick = function(event) {
        if (event.target === customAlert) {
            customAlert.style.display = 'none';
        }
    };
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('export-button').addEventListener('click', async function() {
        try {
            // Fetch the patterns and titles from storage (assuming browser.storage.local)
            const result = await browser.storage.local.get('patterns');
            const patterns = result.patterns || [];
            if (patterns.length === 0) {
                showCustomAlert(['No patterns to export.']);
                return;
            }

            // Generate filename with current date and time
            const now = new Date();
            const dateTime = now.toISOString().replace(/[:.]/g, '-'); // Replace colons and dots to make it a valid filename
            const filename = `patterns(${dateTime}).json`;

            // Create a blob with the patterns data
            const blob = new Blob([JSON.stringify(patterns, null, 2)], { type: 'application/json' });

            // Create a link element and trigger the download
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showCustomAlert([
                `${patterns.length} patterns exported successfully!`,
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
                const patterns = JSON.parse(text);
    
                // Assuming browser.storage.local is used to store the patterns
                await browser.storage.local.set({ patterns });
    
                showCustomAlert([
                    `${patterns.length} patterns imported successfully!`,
                    `Filename: ${file.name}`
                ]);
            } catch (error) {
                console.error('Error parsing JSON:', error);
                showCustomAlert(['Failed to import patterns.', 'Invalid JSON format.']);
            }
        };
    });
});