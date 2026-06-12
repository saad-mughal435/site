/* =========================================================
   Contact page entry (replaces styles.css + script.js + contact.js)
   - Shell CSS + shared shell interactions + back-to-top
   - Contact form: submits via Formsubmit.co AJAX endpoint,
     inline validation + success/error state, mailto: fallback
     button stays in sync with form contents.
   The Ask Saad chatbot stays as plain /ask/... tags in the HTML.
   ========================================================= */

import '../../styles/shell.css';
import '../../lib/shell';
import '../../lib/back-to-top';

(function () {
  const form = document.getElementById('contact-form') as HTMLFormElement | null;
  if (!form) return;

  const btn     = document.getElementById('submit-btn') as HTMLButtonElement;
  const status  = document.getElementById('form-status') as HTMLElement;
  const mailto  = document.getElementById('mailto-fallback') as HTMLAnchorElement;
  const counter = document.getElementById('char-count');

  const fields = {
    name:    form.querySelector('#f-name') as HTMLInputElement,
    email:   form.querySelector('#f-email') as HTMLInputElement,
    company: form.querySelector('#f-company') as HTMLInputElement,
    topic:   form.querySelector('#f-topic') as HTMLSelectElement,
    message: form.querySelector('#f-message') as HTMLTextAreaElement,
    honey:   form.querySelector('input[name="_honey"]') as HTMLInputElement | null,
  };

  const ENDPOINT      = 'https://formsubmit.co/ajax/saad@saadm.dev';
  const TARGET_EMAIL  = 'saad@saadm.dev';
  const MAX_MSG_CHARS = 2000;

  /* ---------- char counter ---------- */
  fields.message.addEventListener('input', () => {
    if (fields.message.value.length > MAX_MSG_CHARS) {
      fields.message.value = fields.message.value.slice(0, MAX_MSG_CHARS);
    }
    if (counter) counter.textContent = String(fields.message.value.length);
    updateMailto();
  });

  /* ---------- keep mailto fallback in sync ---------- */
  ['input', 'change'].forEach(evt => {
    Object.values(fields).forEach(el => el && el.addEventListener(evt, updateMailto));
  });

  function updateMailto() {
    const subject = `Portfolio enquiry from ${fields.name.value || '[your name]'} (${fields.topic.value})`;
    const lines = [
      `Name:    ${fields.name.value}`,
      `Email:   ${fields.email.value}`,
      `Company: ${fields.company.value || '-'}`,
      `Topic:   ${fields.topic.value}`,
      '',
      '-',
      fields.message.value || '(write your message here)',
    ];
    const body = encodeURIComponent(lines.join('\n'));
    mailto.href = `mailto:${TARGET_EMAIL}?subject=${encodeURIComponent(subject)}&body=${body}`;
  }
  updateMailto();

  /* ---------- validation ---------- */
  function validate() {
    let ok = true;
    [fields.name, fields.email, fields.message].forEach(el => {
      const row = el.closest('.form-row') as HTMLElement;
      row.classList.remove('invalid');
      let valid = el.value.trim().length > 0;
      if (el.type === 'email') valid = valid && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim());
      if (!valid) {
        row.classList.add('invalid');
        if (!row.querySelector('.err-msg')) {
          const e = document.createElement('div');
          e.className = 'err-msg';
          e.textContent = el.type === 'email' ? 'Please enter a valid email.' : 'This field is required.';
          row.appendChild(e);
        }
        ok = false;
      }
    });
    return ok;
  }

  /* ---------- status helpers ---------- */
  function showStatus(kind: 'success' | 'error', html: string) {
    status.className = 'form-status show ' + kind;
    status.innerHTML = html;
  }
  function clearStatus() {
    status.className = 'form-status';
    status.innerHTML = '';
  }

  /* ---------- submit ---------- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearStatus();

    // honeypot - silently ignore bots
    if (fields.honey && fields.honey.value) return;

    if (!validate()) {
      showStatus('error', 'Please fill in the highlighted fields.');
      return;
    }

    btn.classList.add('loading');
    btn.disabled = true;
    btn.querySelector('.btn-label')!.textContent = 'Sending';

    const payload = new FormData(form);

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        body: payload,
        headers: { 'Accept': 'application/json' },
      });

      if (res.ok) {
        showStatus('success',
          `<div class="sent-anim">
             <svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="12"/><path d="M7 13.5l4 4 8-9"/></svg>
             <div>
               <strong>Message sent.</strong> I'll get back to you within 24 hours.
               <span class="small">If this is your first time submitting, I may need to confirm receipt before delivery starts. Either way, your message is on its way.</span>
             </div>
           </div>`);
        form.reset();
        if (counter) counter.textContent = '0';
        updateMailto();
      } else {
        throw new Error('Bad response: ' + res.status);
      }
    } catch (err) {
      showStatus('error',
        `Something went wrong sending the form. You can still reach me directly at
         <a href="mailto:${TARGET_EMAIL}" style="color:inherit;text-decoration:underline;">${TARGET_EMAIL}</a>
         or use the <em>Open in email app</em> button.`);
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
      btn.querySelector('.btn-label')!.textContent = 'Send message';
    }
  });
})();
