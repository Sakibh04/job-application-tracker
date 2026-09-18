'use strict';
let jobs = [];
let sortColumn = 'created_at';
let sortOrder = 'desc';
let editingJobId = null;
let deletingJobId = null;
let loadingVersion = 0;
const $ = id => document.getElementById(id);
const statuses = ['applied', 'interview', 'offer', 'rejected', 'withdrawn'];

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
    if (response.status === 401) {
        window.location.assign('/');
        throw new Error('Please sign in again.');
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The request failed. Please try again.');
    return result;
}
async function logout() {
    try {
        await apiRequest('/api/logout', {
            method: 'POST'
        });
        window.location.assign('/');
    } catch {
        showMessage('Unable to sign out. Please try again.');
    }
}
async function loadJobs() {
    const version = ++loadingVersion;
    $('loading').hidden = false;
    $('emptyState').hidden = true;
    $('loadError').hidden = true;
    $('tableContainer').setAttribute('aria-busy', 'true');
    try {
        const data = await apiRequest('/api/jobs');
        if (version !== loadingVersion) return;
        jobs = data;
        updateStats();
        renderTable();
    } catch {
        if (version !== loadingVersion) return;
        $('loadError').hidden = false;
        $('listSummary').textContent = 'Applications unavailable';
    } finally {
        if (version === loadingVersion) {
            $('loading').hidden = true;
            $('tableContainer').setAttribute('aria-busy', 'false');
        }
    }
}

function updateStats() {
    $('count-all').textContent = String(jobs.length).padStart(2, '0');
    for (const status of ['applied', 'interview', 'offer']) {
        $(`count-${status}`).textContent = String(jobs.filter(job => job.status === status).length).padStart(2, '0');
    }
}

function renderTable() {
    const query = $('searchInput').value.trim().toLowerCase();
    const status = $('statusFilter').value;
    const filtered = jobs.filter(job => (!status || job.status === status) && `${job.company} ${job.position}`.toLowerCase().includes(query));
    filtered.sort((a, b) => {
        const left = a[sortColumn] || '';
        const right = b[sortColumn] || '';
        return String(left).localeCompare(String(right), undefined, {
            numeric: true,
            sensitivity: 'base'
        }) * (sortOrder === 'asc' ? 1 : -1);
    });
    $('resultCount').textContent = filtered.length;
    $('listSummary').textContent = `${filtered.length} of ${jobs.length} application${jobs.length === 1 ? '' : 's'}`;
    $('clearFilters').hidden = !query && !status;
    $('emptyState').hidden = filtered.length > 0;
    if (!filtered.length) {
        const isFiltered = Boolean(query || status);
        $('emptyTitle').textContent = isFiltered ? 'No matching applications.' : 'Your next chapter starts here.';
        $('emptyDescription').textContent = isFiltered ? 'Try a different company, position, or status.' : 'Add your first application to start keeping track of your search.';
        $('emptyAction').textContent = isFiltered ? 'Clear filters' : 'Add application';
        $('emptyAction').onclick = isFiltered ? clearFilters : () => openModal();
    }
    $('jobTableBody').innerHTML = filtered.map(job => {
        const status = statuses.includes(job.status) ? job.status : 'applied';
        const url = safeUrl(job.job_url);
        const initials = job.company.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
        return `<tr><td><div class="company-cell"><span class="company-monogram" aria-hidden="true">${escapeHtml(initials)}</span><div><span class="company-name">${escapeHtml(job.company)}</span>${url ? `<a class="posting-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">View job posting</a>` : ''}</div></div></td><td>${escapeHtml(job.position)}</td><td><span class="status ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span></td><td class="date-cell">${escapeHtml(formatDate(job.applied_date))}</td><td><div class="action-buttons"><button class="row-action" data-action="edit" data-id="${Number(job.id)}" aria-label="Edit ${escapeHtml(job.position)} at ${escapeHtml(job.company)}">Edit</button><button class="row-action delete" data-action="delete" data-id="${Number(job.id)}" aria-label="Delete ${escapeHtml(job.position)} at ${escapeHtml(job.company)}">Delete</button></div></td></tr>`;
    }).join('');
}

function safeUrl(value) {
    try {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
        return '';
    }
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    } [char]));
}

function formatDate(value) {
    if (!value) return 'Not set';
    const date = new Date(`${value.slice(0,10)}T12:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function setStatus(status) {
    $('statusFilter').value = status;
    document.querySelectorAll('.stat-item').forEach(item => {
        const selected = item.dataset.status === status;
        item.classList.toggle('selected', selected);
        item.setAttribute('aria-pressed', String(selected));
    });
    renderTable();
}

function clearFilters() {
    $('searchInput').value = '';
    setStatus('');
}

function sortTable(column) {
    sortOrder = sortColumn === column && sortOrder === 'asc' ? 'desc' : 'asc';
    sortColumn = column;
    document.querySelectorAll('th[data-column]').forEach(th => th.setAttribute('aria-sort', th.dataset.column === column ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'));
    renderTable();
}

function openModal(id = null) {
    editingJobId = id;
    $('jobForm').reset();
    $('formError').textContent = '';
    $('modalTitle').textContent = id === null ? 'Add application' : 'Edit application';
    const job = jobs.find(item => item.id === id);
    if (job) {
        for (const [field, key] of Object.entries({
                company: 'company',
                position: 'position',
                status: 'status',
                appliedDate: 'applied_date',
                jobUrl: 'job_url',
                salary: 'salary',
                notes: 'notes'
            })) $(field).value = job[key] || '';
    } else {
        const now = new Date();
        const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
        $('appliedDate').value = localDate.toISOString().slice(0, 10);
    }
    $('jobModal').showModal();
    $('company').focus();
}

function closeModal() {
    $('jobModal').close();
}
async function handleFormSubmit(event) {
    event.preventDefault();
    const button = $('saveButton');
    const original = button.innerHTML;
    const id = editingJobId;
    const data = {};
    for (const field of ['company', 'position', 'status', 'appliedDate', 'jobUrl', 'salary', 'notes']) data[field] = $(field).value.trim();
    if (!data.company || !data.position) {
        $('formError').textContent = 'Company and position are required.';
        return;
    }
    button.disabled = true;
    button.textContent = 'Saving…';
    $('formError').textContent = '';
    try {
        await apiRequest(id === null ? '/api/jobs' : `/api/jobs/${id}`, {
            method: id === null ? 'POST' : 'PUT',
            body: JSON.stringify(data)
        });
        closeModal();
        showMessage(id === null ? 'Application added.' : 'Application updated.');
        await loadJobs();
    } catch (failure) {
        $('formError').textContent = failure.message;
    } finally {
        button.disabled = false;
        button.innerHTML = original;
    }
}

function deleteJob(id) {
    deletingJobId = id;
    const job = jobs.find(item => item.id === id);
    $('deleteDescription').textContent = `${job.position} at ${job.company}`;
    $('deleteError').textContent = '';
    $('deleteModal').showModal();
}
async function confirmDelete() {
    const button = $('confirmDelete');
    button.disabled = true;
    button.textContent = 'Deleting…';
    try {
        await apiRequest(`/api/jobs/${deletingJobId}`, {
            method: 'DELETE'
        });
        $('deleteModal').close();
        showMessage('Application deleted.');
        await loadJobs();
    } catch (failure) {
        $('deleteError').textContent = failure.message;
    } finally {
        button.disabled = false;
        button.textContent = 'Delete application';
    }
}
async function exportToCSV() {
    try {
        const response = await fetch('/api/export/csv');
        if (response.status === 401) {
            window.location.assign('/');
            return;
        }
        if (!response.ok) throw new Error('Export failed');
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement('a');
        link.href = url;
        link.download = `job_applications_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showMessage('Applications exported.');
    } catch {
        showMessage('Unable to export applications. Please try again.');
    }
}
$('jobForm').addEventListener('submit', handleFormSubmit);
$('searchInput').addEventListener('input', renderTable);
$('confirmDelete').addEventListener('click', confirmDelete);
$('jobTableBody').addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const id = Number(button.dataset.id);
    if (button.dataset.action === 'edit') openModal(id);
    else deleteJob(id);
});
loadJobs();
