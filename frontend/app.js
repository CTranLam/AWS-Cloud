const API = 'https://yfe93wjfjg.execute-api.ap-southeast-1.amazonaws.com/dev/todos';

let allTodos = [];
let currentFilter = 'all';

// API Gateway non-proxy integration returns { statusCode, headers, body }
// This unwraps it so we always get the actual data
async function apiFetch(url, options) {
    const res = await fetch(url, options);
    let data = await res.json();
    if (data && typeof data.body === 'string') data = JSON.parse(data.body);
    return data;
}

async function loadTodos() {
    const list = document.getElementById('todos-list');
    list.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">Loading...</p>';
    try {
        const data = await apiFetch(API);
        allTodos = Array.isArray(data) ? data : [];
    } catch (e) {
        list.innerHTML = `<p style="text-align:center;color:#ef4444;padding:20px;">Failed to load: ${e.message}</p>`;
        return;
    }
    renderTodos();
}

function renderTodos() {
    const list = document.getElementById('todos-list');
    const filtered = currentFilter === 'all' ? allTodos : allTodos.filter(t => t.status === currentFilter);

    if (!filtered.length) {
        list.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">No todos found.</p>';
        return;
    }

    list.innerHTML = filtered.map(todo => `
        <div class="list-item ${todo.status === 'completed' ? 'done' : ''}">
            <div>
                <h3>${todo.name}</h3>
                <p>Due: ${todo.date || 'No date'}</p>
            </div>
            <div class="item-actions">
                <span class="badge badge-${todo.status === 'completed' ? 'done' : 'pending'}">${todo.status}</span>
                <button class="btn-edit" onclick="editTodo('${todo.id}')">Edit</button>
                ${todo.status === 'pending'
                    ? `<button class="btn-primary" style="padding:8px 16px;font-size:12px;" onclick="markDone('${todo.id}')">✓ Done</button>`
                    : ''}
                <button class="btn-delete" onclick="deleteTodo('${todo.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function filterTodos(filter, btn) {
    currentFilter = filter;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    renderTodos();
}

function showForm() {
    document.getElementById('form-title').textContent = 'Add Todo';
    document.getElementById('todo-id').value = '';
    document.getElementById('todo-name').value = '';
    document.getElementById('todo-date').value = '';
    document.getElementById('todo-status').classList.add('hidden');
    document.getElementById('todo-form').classList.remove('hidden');
}

function hideForm() {
    document.getElementById('todo-form').classList.add('hidden');
}

function editTodo(id) {
    const todo = allTodos.find(t => t.id === id);
    if (!todo) return;
    document.getElementById('form-title').textContent = 'Edit Todo';
    document.getElementById('todo-id').value = todo.id;
    document.getElementById('todo-name').value = todo.name;
    document.getElementById('todo-date').value = todo.date || '';
    const statusEl = document.getElementById('todo-status');
    statusEl.value = todo.status;
    statusEl.classList.remove('hidden');
    document.getElementById('todo-form').classList.remove('hidden');
}

async function saveTodo() {
    const id = document.getElementById('todo-id').value;
    const name = document.getElementById('todo-name').value.trim();
    const date = document.getElementById('todo-date').value;
    const status = document.getElementById('todo-status').value;
    if (!name) return alert('Name is required');

    const url = id ? `${API}?id=${id}` : API;
    const body = id ? { name, date, status } : { name, date, status: 'pending' };
    await apiFetch(url, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    hideForm();
    loadTodos();
}

async function markDone(id) {
    await apiFetch(`${API}?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
    });
    loadTodos();
}

async function deleteTodo(id) {
    if (!confirm('Delete this todo?')) return;
    await apiFetch(`${API}?id=${id}`, { method: 'DELETE' });
    loadTodos();
}

loadTodos();
