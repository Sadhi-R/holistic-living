const form = document.querySelector('[data-contact-form]');
if (form instanceof HTMLFormElement) {
  const started = form.querySelector('input[name="startedAt"]');
  if (started instanceof HTMLInputElement) started.value = String(Date.now());
  const params = new URLSearchParams(location.search);
  const topic = params.get('topic');
  const enquiry = form.querySelector('[name="enquiry"]');
  if (topic && enquiry instanceof HTMLSelectElement && [...enquiry.options].some((option) => option.value === topic)) {
    enquiry.value = topic;
  }

  const status = document.getElementById('form-status');
  const button = form.querySelector('button[type="submit"]');
  const spinner = form.querySelector('.spinner');
  const label = form.querySelector('.submit-label');
  const fields = ['fullName', 'email', 'phone', 'enquiry', 'message', 'consent'];
  let sending = false;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending) return;
    clearErrors();
    if (status) status.hidden = true;
    const data = new FormData(form);
    const local = localErrors(data);
    if (Object.keys(local).length) {
      applyErrors(local);
      showStatus('bad', local.form || 'Please correct the highlighted fields.');
      return;
    }

    sending = true;
    if (button instanceof HTMLButtonElement) button.disabled = true;
    if (spinner instanceof HTMLElement) spinner.hidden = false;
    if (label) label.textContent = 'Sending…';

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(data),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok && body.ok) {
        form.reset();
        if (started instanceof HTMLInputElement) started.value = String(Date.now());
        showStatus('ok', body.message || 'Thank you. Your enquiry has been sent.');
      } else {
        if (body.fields) applyErrors(body.fields);
        showStatus('bad', body.error || body.message || 'We could not send your enquiry. Please try again.');
      }
    } catch {
      showStatus('bad', 'We could not reach the server. Check your connection, or call or WhatsApp us. Your details are still in the form.');
    } finally {
      sending = false;
      if (button instanceof HTMLButtonElement) button.disabled = false;
      if (spinner instanceof HTMLElement) spinner.hidden = true;
      if (label) label.textContent = 'Send enquiry';
    }
  });

  function clearErrors() {
    fields.forEach((name) => {
      const error = document.getElementById(`err-${name}`);
      const input = form.querySelector(`[name="${name}"]`);
      if (error) {
        error.hidden = true;
        error.textContent = '';
      }
      input?.closest('.field')?.classList.remove('invalid');
      input?.removeAttribute('aria-invalid');
    });
  }

  function applyErrors(errors) {
    Object.entries(errors).forEach(([name, message]) => {
      if (name === 'form') return;
      const error = document.getElementById(`err-${name}`);
      const input = form.querySelector(`[name="${name}"]`);
      if (error) {
        error.hidden = false;
        error.textContent = message;
      }
      input?.closest('.field')?.classList.add('invalid');
      input?.setAttribute('aria-invalid', 'true');
      input?.setAttribute('aria-describedby', `err-${name}`);
    });
  }

  function showStatus(kind, message) {
    if (!status) return;
    status.hidden = false;
    status.className = `status ${kind}`;
    status.textContent = message;
  }
}

function localErrors(data) {
  const errors = {};
  const name = String(data.get('fullName') || '').trim();
  if (!/^[\p{L}][\p{L}\s.'-]{1,79}$/u.test(name)) {
    errors.fullName = 'Enter your full name using letters, spaces, hyphens, or apostrophes.';
  }
  const email = String(data.get('email') || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = 'Enter a valid email address so we can reply.';
  const phone = String(data.get('phone') || '').replace(/[\s().-]/g, '');
  if (!/^(?:\+91|91|0)?[6-9]\d{9}$/.test(phone) && !/^\+[1-9]\d{7,14}$/.test(phone)) {
    errors.phone = 'Enter a valid phone number. Indian mobile numbers should be 10 digits starting with 6, 7, 8, or 9.';
  }
  if (String(data.get('message') || '').trim().length < 10) {
    errors.message = 'Please write at least a short message (10 characters or more).';
  }
  if (data.get('consent') !== 'yes') errors.consent = 'Please confirm that we may use these details to reply to you.';
  return errors;
}
