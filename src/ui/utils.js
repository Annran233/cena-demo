/* ui/utils.js — UI 工具函数
   依赖：无
   复赛迁移：web/src/utils/ui.ts
*/

function renderStars(rating) {
  const full = Math.round(rating);
  let html = '<span class="stars">';
  for (let i = 1; i <= 5; i++) html += i <= full ? '★' : '<span class="empty">★</span>';
  html += '</span>';
  return html;
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('is-show');
  setTimeout(() => el.classList.remove('is-show'), 1800);
}

function debounce(fn, wait) {
  let t;
  return function(...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), wait); };
}
