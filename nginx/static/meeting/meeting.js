document.addEventListener('DOMContentLoaded', () => {
    const pingBtn = document.getElementById('pingBtn');
    const statusText = document.getElementById('statusText');
    const friendContext = document.getElementById('friendContext');
    const heatmapStatus = document.getElementById('heatmapStatus');
    const heatmap = document.getElementById('heatmap');
    const hintText = document.getElementById('hintText');
    const eventsLink = document.getElementById('eventsLink');

    if (!pingBtn || !statusText || !friendContext || !heatmapStatus || !heatmap || !hintText || !eventsLink) {
        return;
    }

    const friendId = extractFriendId(window.location.pathname);

    if (friendId === null) {
        friendContext.textContent = 'Route format required: /meeting/{friendId}';
        hintText.textContent = 'Missing friendId. Example: /meeting/12';
        heatmapStatus.textContent = 'No friend selected.';
        renderHeatmap(heatmap, new Map(), new Date());
        return;
    }

    friendContext.textContent = `Friend ${friendId} meeting activity`;
    hintText.textContent = `Reading meetings from API for friend ${friendId}.`;
    eventsLink.href = `/events/?friendId=${friendId}`;

    loadMeetings(friendId)
        .then((items) => {
            const counts = aggregateByDate(items);
            renderHeatmap(heatmap, counts, new Date());
            heatmapStatus.textContent = `Loaded ${items.length} meetings.`;
        })
        .catch(() => {
            renderHeatmap(heatmap, new Map(), new Date());
            heatmapStatus.textContent = 'Could not load meetings, showing empty heatmap.';
        });

    pingBtn.addEventListener('click', () => {
        statusText.textContent = 'UI ready';
        statusText.style.color = '#1e7f88';

        window.setTimeout(() => {
            statusText.textContent = 'Idle';
            statusText.style.color = '';
        }, 1300);
    });
});

function extractFriendId(pathname) {
    const match = pathname.match(/\/meeting\/(\d+)\/?$/);
    if (!match) {
        return null;
    }
    return Number(match[1]);
}

async function loadMeetings(friendId) {
    const response = await fetch(`/api/friend/friends/${friendId}/meetings`);
    if (!response.ok) {
        throw new Error('meetings fetch failed');
    }
    return response.json();
}

function aggregateByDate(meetings) {
    const map = new Map();
    for (const meeting of meetings) {
        if (!meeting || !meeting.meetingDate) {
            continue;
        }
        const key = meeting.meetingDate;
        const current = map.get(key) || 0;
        map.set(key, current + 1);
    }
    return map;
}

function renderHeatmap(container, countsByDate, today) {
    container.innerHTML = '';

    const days = 7 * 12;
    const start = new Date(today);
    start.setDate(today.getDate() - (days - 1));

    for (let i = 0; i < days; i += 1) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const key = formatDateKey(d);
        const value = countsByDate.get(key) || 0;

        const cell = document.createElement('span');
        cell.className = `heatmap-cell lvl-${levelFor(value)}`;
        cell.title = `${key}: ${value} meetings`;
        container.appendChild(cell);
    }
}

function formatDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function levelFor(value) {
    if (value <= 0) {
        return 0;
    }
    if (value === 1) {
        return 1;
    }
    if (value === 2) {
        return 2;
    }
    if (value <= 4) {
        return 3;
    }
    return 4;
}
