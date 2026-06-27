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

// ======== 用户身份 mock（纯 localStorage，无后端） ========

/* 获取当前用户身份：首次访问时随机生成昵称+头像，持久化到localStorage */
function getUserProfile() {
  let profile = null;
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    if (raw) profile = JSON.parse(raw);
  } catch(e) { /* 忽略解析失败 */ }
  // 首次访问或解析失败：生成新身份
  if (!profile || !profile.nick || !profile.avatar) {
    profile = generateUserProfile();
    saveUserProfile(profile);
  }
  return profile;
}

/* 随机生成用户身份：昵称=前缀+#编号，头像=emoji池随机取 */
function generateUserProfile() {
  const prefix = USER_NICK_PREFIXES[Math.floor(Math.random() * USER_NICK_PREFIXES.length)];
  const num = Math.floor(Math.random() * (USER_NICK_MAX - USER_NICK_MIN + 1)) + USER_NICK_MIN;
  const avatar = USER_AVATAR_POOL[Math.floor(Math.random() * USER_AVATAR_POOL.length)];
  return {
    nick: prefix + '#' + num,
    avatar: avatar,
    createdAt: Date.now(),
    // 贡献统计
    reports: 0,     // 上报厕所次数
    confirms: 0,    // 状态确认次数
    comments: 0,    // 评论次数
    tags: 0         // 设施标签补充次数
  };
}

/* 保存用户身份到localStorage */
function saveUserProfile(profile) {
  try {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  } catch(e) { /* 忽略写入失败 */ }
}

/* 获取当前用户昵称（评论/上报时使用，替代固定"你"） */
function getUserNick() {
  return getUserProfile().nick;
}

/* 增加贡献计数：type = reports|confirms|comments|tags */
function incrUserContribution(type, count) {
  const profile = getUserProfile();
  profile[type] = (profile[type] || 0) + (count || 1);
  saveUserProfile(profile);
  // 同步导航栏头像（无视觉变化，但确保profile已初始化）
  updateNavAvatar();
}

/* 更新导航栏头像emoji */
function updateNavAvatar() {
  const el = document.getElementById('navProfileAvatar');
  if (el) el.textContent = getUserProfile().avatar;
}
