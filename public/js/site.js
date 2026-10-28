document.documentElement.classList.add('js');
const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());

const button = document.querySelector('.nav-toggle');
const nav = document.querySelector('#site-nav');
button?.addEventListener('click', () => {
  const open = nav?.classList.toggle('open');
  button.setAttribute('aria-expanded', open ? 'true' : 'false');
  button.textContent = open ? 'Close' : 'Menu';
});
