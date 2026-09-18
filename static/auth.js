'use strict';

function showAuth(mode) {
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    document.getElementById(`${mode}Error`).textContent = '';
    document.getElementById(`${mode}Modal`).showModal();
}
for (const mode of ['login', 'register']) {
    document.getElementById(`${mode}Form`).addEventListener('submit', async event => {
        event.preventDefault();
        const button = event.target.querySelector('[type="submit"]');
        const original = button.innerHTML;
        const error = document.getElementById(`${mode}Error`);
        error.textContent = '';
        const data = {
            username: document.getElementById(`${mode}Username`).value.trim(),
            password: document.getElementById(`${mode}Password`).value
        };
        if (mode === 'register') {
            data.email = document.getElementById('registerEmail').value.trim();
            data.confirmPassword = document.getElementById('registerConfirm').value;
            if (data.password !== data.confirmPassword) {
                error.textContent = 'Passwords do not match.';
                document.getElementById('registerConfirm').focus();
                return;
            }
        }
        button.disabled = true;
        button.textContent = mode === 'login' ? 'Signing in…' : 'Creating account…';
        try {
            const response = await fetch(`/api/${mode}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.errors ? [...new Set(Object.values(result.errors))].join('\n') : result.error || 'Something went wrong. Please try again.');
            window.location.assign('/dashboard');
        } catch (failure) {
            error.textContent = failure instanceof TypeError ? 'Unable to connect. Please try again.' : failure.message;
            button.disabled = false;
            button.innerHTML = original;
        }
    });
}
