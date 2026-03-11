(() => {
    const state = { token: null };

    async function api(url, payload) {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
            },
            body: JSON.stringify(payload || {}),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Request failed ${response.status}`);
        return data;
    }

    async function apiGet(url) {
        const response = await fetch(url, {
            headers: state.token ? { Authorization: `Bearer ${state.token}` } : {},
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Request failed ${response.status}`);
        return data;
    }

    async function refreshVectors() {
        const list = document.getElementById('vector-list');
        const store = await apiGet('/api/vector/workspace');
        list.innerHTML = store.vectors
            .slice(0, 20)
            .map((v) => `<li><strong>${v.createdAt}</strong><br/>${v.text}</li>`)
            .join('');
    }

    document.getElementById('login-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        try {
            const data = await api('/api/auth/login', { username, password });
            state.token = data.token;
            document.getElementById('auth-status').textContent = `Authenticated as ${data.username}`;
            await refreshVectors();
        } catch (error) {
            document.getElementById('auth-status').textContent = error.message;
        }
    });

    document.getElementById('vector-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            await api('/api/vector/workspace', { text: document.getElementById('vector-text').value });
            document.getElementById('vector-text').value = '';
            await refreshVectors();
        } catch (error) {
            alert(error.message);
        }
    });

    document.getElementById('chat-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const message = document.getElementById('chat-input').value;
        try {
            const data = await api('/api/chat', { message });
            document.getElementById('chat-output').textContent = JSON.stringify(data, null, 2);
            if (data.action === 'read' && data.content) {
                document.getElementById('file-content').value = data.content;
                document.getElementById('file-path').value = data.path;
            }
        } catch (error) {
            document.getElementById('chat-output').textContent = error.message;
        }
    });

    document.getElementById('read-file').addEventListener('click', async () => {
        try {
            const path = document.getElementById('file-path').value;
            const data = await api('/api/files/read', { path });
            document.getElementById('file-content').value = data.content;
            document.getElementById('file-status').textContent = `Loaded ${data.path}`;
        } catch (error) {
            document.getElementById('file-status').textContent = error.message;
        }
    });

    document.getElementById('write-file').addEventListener('click', async () => {
        try {
            const path = document.getElementById('file-path').value;
            const content = document.getElementById('file-content').value;
            const data = await api('/api/files/write', { path, content });
            document.getElementById('file-status').textContent = `Wrote ${data.path} (${data.bytes} bytes)`;
        } catch (error) {
            document.getElementById('file-status').textContent = error.message;
        }
    });
})();
