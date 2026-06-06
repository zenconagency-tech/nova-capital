/* ============================================================================
   Nova — toast notification system.
   Usage:
     NovaToast.success('Saved!');
     NovaToast.error('Something went wrong', 'Title (optional)');
     NovaToast.show({ type: 'info', title: '…', message: '…', duration: 4000 });
   ============================================================================ */
(function () {
  const ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  };

  const ensureStack = () => {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    return stack;
  };

  const show = ({ type = 'info', title = '', message = '', duration = 4000 } = {}) => {
    const stack = ensureStack();
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `
      <div class="ic">${ICONS[type] || ICONS.info}</div>
      <div class="body">
        ${title ? `<div class="title">${escapeHtml(title)}</div>` : ''}
        ${message ? `<div class="msg">${escapeHtml(message)}</div>` : ''}
      </div>
      <button class="close" aria-label="Dismiss">×</button>
    `;
    stack.appendChild(el);

    const dismiss = () => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 260);
    };
    el.querySelector('.close').addEventListener('click', dismiss);
    if (duration > 0) setTimeout(dismiss, duration);
    return dismiss;
  };

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );

  // Wrap a promise so success/error are toasted automatically.
  // If the promise resolves, shows success; if it rejects, shows error.
  const wrap = async (promise, { success, error } = {}) => {
    try {
      const result = await promise;
      if (success) show({ type: 'success', title: typeof success === 'string' ? success : null, message: typeof success === 'string' ? '' : (result?.data?.message || result?.message || 'Done.') });
      return result;
    } catch (e) {
      const message = e?.data?.message || e?.message || 'Something went wrong.';
      show({ type: 'error', title: typeof error === 'string' ? error : 'Error', message });
      throw e;
    }
  };

  // Mount once on load
  document.addEventListener('DOMContentLoaded', () => ensureStack());

  window.NovaToast = {
    show,
    success: (message, title = 'Success') => show({ type: 'success', title, message }),
    error:   (message, title = 'Error')    => show({ type: 'error',   title, message }),
    info:    (message, title = '')         => show({ type: 'info',    title, message }),
    warning: (message, title = 'Warning')  => show({ type: 'warning', title, message }),
    wrap,
  };
})();
