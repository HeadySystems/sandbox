async function request(url, options = {}) {
    const response = await fetch(url, {
        headers: { 'content-type': 'application/json' },
        ...options
    });
    return response.json();
}

const sessionId = document.getElementById('sessionId');
const message = document.getElementById('message');
const chatOut = document.getElementById('chatOut');
const filePath = document.getElementById('filePath');
const fileContent = document.getElementById('fileContent');
const ideOut = document.getElementById('ideOut');

document.getElementById('sendChat').addEventListener('click', async () => {
    const result = await request('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ sessionId: sessionId.value, message: message.value })
    });
    const workspace = await request(`/api/workspace?sessionId=${encodeURIComponent(sessionId.value)}`);
    chatOut.textContent = JSON.stringify({ result, workspace }, null, 2);
});

document.getElementById('saveFile').addEventListener('click', async () => {
    const result = await request('/api/ide/write', {
        method: 'POST',
        body: JSON.stringify({ path: filePath.value, content: fileContent.value })
    });
    ideOut.textContent = JSON.stringify(result, null, 2);
});

document.getElementById('loadFile').addEventListener('click', async () => {
    const result = await request(`/api/ide/read?path=${encodeURIComponent(filePath.value)}`);
    if (result && result.content) fileContent.value = result.content;
    ideOut.textContent = JSON.stringify(result, null, 2);
});

document.getElementById('listFiles').addEventListener('click', async () => {
    const result = await request('/api/ide/list');
    ideOut.textContent = JSON.stringify(result, null, 2);
});
