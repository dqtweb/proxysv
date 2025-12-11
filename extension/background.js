chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'SELECTION_UPDATED') {
        // Broadcast xuống toàn bộ tab hiện đang chạy extension
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                if (!tab.id) return;
                chrome.tabs.sendMessage(tab.id, {
                    type: 'SELECTION_UPDATED',
                    payload: msg.payload
                });
            });
        });
    }
});