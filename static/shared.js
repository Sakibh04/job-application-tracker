'use strict';

function showMessage(message) {
    const item = document.createElement('div');
    item.className = 'message';
    item.textContent = message;
    document.getElementById('messageContainer').replaceChildren(item);
    setTimeout(() => item.remove(), 5000);
}
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('dialog').forEach(dialog => {
        dialog.addEventListener('click', event => {
            if (event.target !== dialog) return;
            const rect = dialog.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
        });
    });
});
