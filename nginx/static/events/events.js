document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('eventForm');
    const result = document.getElementById('result');
    const friendIdInput = document.getElementById('friendId');
    const contextText = document.getElementById('contextText');
    const meetingLink = document.getElementById('meetingLink');

    if (!form || !result || !friendIdInput || !contextText || !meetingLink) {
        return;
    }

    const queryFriendId = new URLSearchParams(window.location.search).get('friendId');
    if (queryFriendId && Number(queryFriendId) > 0) {
        friendIdInput.value = queryFriendId;
        contextText.textContent = `Create event for friend ${queryFriendId}.`;
        meetingLink.href = `/meeting/${queryFriendId}`;
    }

    friendIdInput.addEventListener('change', () => {
        const v = Number(friendIdInput.value);
        meetingLink.href = v > 0 ? `/meeting/${v}` : '/meeting/';
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        result.textContent = 'Submitting...';

        const friendId = Number(friendIdInput.value);
        if (!friendId || friendId < 1) {
            result.textContent = 'Friend ID must be a positive number.';
            return;
        }

        const payload = {
            eventType: document.getElementById('eventType').value.trim(),
            title: document.getElementById('title').value.trim(),
            baseDate: document.getElementById('baseDate').value,
            recurrenceDays: Number(document.getElementById('recurrenceDays').value),
            keepMeetingDate: document.getElementById('keepMeetingDate').checked,
            active: document.getElementById('active').checked,
            notes: document.getElementById('notes').value.trim()
        };

        try {
            const response = await fetch(`/api/friend/friends/${friendId}/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || 'Event creation failed');
            }

            result.textContent = 'Event created successfully.';
            form.reset();
            friendIdInput.value = String(friendId);
            document.getElementById('keepMeetingDate').checked = true;
            document.getElementById('active').checked = true;
            document.getElementById('recurrenceDays').value = '365';
        } catch (error) {
            result.textContent = `Error: ${error.message}`;
        }
    });
});
