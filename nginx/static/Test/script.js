document.getElementById('chatForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const message = document.getElementById('message').value;
    const question = document.getElementById('question').value;
    const payload = { message };
    if (question) payload.question = question;
    try {
        const res = await fetch('http://localhost:8090/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        document.getElementById('response').textContent = JSON.stringify(data, null, 2);
    } catch (err) {
        document.getElementById('response').textContent = 'Error: ' + err;
    }
});
