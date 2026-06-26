/* ui/panel.js — 详情面板（上报 + 评论）
   依赖：core/confidence.js, core/status.js, ui/utils.js, ui/map.js (renderMarkers), ui/nearby.js (renderNearbyList)
   复赛迁移：web/src/components/Panel.ts
*/

let currentToilet = null;

/* 渲染补充设施按钮：3态（未标注/待复核/已确认）
   判断逻辑：先看 t.id 是否以 user_ 开头（持久化对象），直接读 t[tag]
   否则（MOCK/live 拷贝），看 getSupplementStatus() 返回的补充状态 */
function renderSupplementBtn(t, tag, emoji, label) {
  // 持久化对象（userToilets 里的）：标签直接来自对象属性
  if (t.id && t.id.startsWith('user_')) {
    if (t[tag]) {
      return `<div class="report-btn supplement-btn is-confirmed" data-supplement="${tag}" data-action="revoke"><span class="emoji">${emoji}</span>${label} ✓</div>`;
    }
    return `<div class="report-btn supplement-btn" data-supplement="${tag}" data-action="add"><span class="emoji">${emoji}</span>${label}</div>`;
  }
  // 非持久化对象（MOCK 拷贝 / live 拷贝）：看补充标签状态
  const status = getSupplementStatus(t, tag);
  if (status === 'confirmed') {
    return `<div class="report-btn supplement-btn is-confirmed" data-supplement="${tag}" data-action="revoke"><span class="emoji">${emoji}</span>${label} ✓✓</div>`;
  }
  if (status === 'pending') {
    return `<div class="report-btn supplement-btn is-pending" data-supplement="${tag}" data-action="revoke"><span class="emoji">${emoji}</span>${label} ✓</div>`;
  }
  return `<div class="report-btn supplement-btn" data-supplement="${tag}" data-action="add"><span class="emoji">${emoji}</span>${label}</div>`;
}

function openPanel(t) {
  currentToilet = t;
  highlightMarker(t.id); // 高亮选中态 marker
  const body = document.getElementById('panelBody');
  // 面板打开时隐藏周边列表（避免两个 Bottom Sheet 重叠）
  collapseNearbyList();
  document.getElementById('nearbyList').style.display = 'none';
  const st = statusMeta(t);
  const src = SOURCE_MAP[t.source] || { label: t.source, cls: 'source-amap' };
  const old = isOld(t);
  const d = daysSince(t.last_update);

  const labels = [];
  if (t.accessible) labels.push('<span class="tag label">♿ 无障碍</span>');
  if (t.family) labels.push('<span class="tag label">👨‍👩‍👧 第三卫生间</span>');
  if (t.water) labels.push('<span class="tag label">🚐 房车水源</span>');

  const commentsHtml = t.comments.map(c => `
    <div class="comment-item">
      <div class="head"><span>${c.user}</span><span>${c.time}</span></div>
      ${renderStars(c.rating)}
      <div class="text">${c.text}</div>
    </div>
  `).join('');

  const statusSub = st.sub ? `<span class="tag status-sub">${st.sub}</span>` : '';
  const isRemoved = t.status === 'removed';
  const reportTitle = isRemoved ? '纠错上报（被误报？点这里恢复）' : '一键上报状态（情报反哺）';
  const openBtnLabel = isRemoved ? '仍在开放' : '开放中';

  // 地址行内容：address 与 desc 并列显示，多个 desc 之间用 "·" 分割
  // 取值：address（高德返回）+ t.desc（原始上报描述）+ 所有已验证（confirmed）的补充描述
  // 未确认（pending）的补充描述不进入地址行，仅在补充区域卡片中展示
  const addrParts = [];
  if (t.address) addrParts.push(t.address);
  if (t.desc) addrParts.push(t.desc);
  // 追加所有已验证的补充描述（排除已写入 t.desc 的那条，避免重复）
  const confirmedDescs = getDescSupplementList(t)
    .filter(d => d.status === 'confirmed' && d.text !== t.desc)
    .map(d => d.text);
  addrParts.push(...confirmedDescs);
  const addrLine = addrParts.join(' · ');
  const addrHtml = addrLine ? `<div class="panel__addr">${addrLine}</div>` : '';

  // 位置描述补充区域：多描述独立确认机制
  // hasOriginal：t.desc 来自上报/高德（非 supplement 合并），显示为"原始位置描述"
  // supplementList：descSupplements 中的描述列表，按 count 降序
  // 状态A 有原始 desc：显示原始卡片 + 补充列表（若有）+ "我有补充"按钮
  // 状态B 无 desc 无补充：显示输入框
  // 状态C 有补充列表：显示卡片列表 + "我有补充"按钮
  const hasOriginal = !!(t.desc && !t._descSupplementStatus);
  const supplementList = getDescSupplementList(t);
  const hasSupplements = supplementList.length > 0;
  const showInputDirectly = !hasOriginal && !hasSupplements;  // 状态B

  // 渲染单条描述卡片
  function renderDescCard(item, isOriginal) {
    if (isOriginal) {
      // 原始描述卡片：只读 + "📍 原始位置描述"标注
      return `
        <div class="desc-card desc-card--original">
          <div class="desc-card__text">${item.text}</div>
          <div class="desc-card__hint"><span class="tag desc-tag-original">📍 原始位置描述</span></div>
        </div>`;
    }
    // 补充描述卡片：文本 + 状态标签 + 👍准确 + 撤销（仅 pending&count=1）
    const statusTag = item.status === 'confirmed'
      ? '<span class="tag is-confirmed">🟢 已确认</span>'
      : '<span class="tag is-pending">🟡 待确认</span>';
    // 撤销按钮仅当 pending 且 count=1（当前用户刚补充的）
    const canUndo = item.status === 'pending' && item.count === 1;
    const undoBtn = canUndo
      ? `<button class="desc-action-btn desc-undo-btn" data-desc-undo="${item.text}" type="button">撤销</button>`
      : '';
    return `
      <div class="desc-card">
        <div class="desc-card__header">
          <div class="desc-card__text">${item.text}</div>
          <div class="desc-card__status">${statusTag}</div>
        </div>
        <div class="desc-card__actions">
          <button class="desc-action-btn desc-confirm-btn" data-desc-confirm="${item.text}" type="button">👍 描述准确</button>
          ${undoBtn}
        </div>
      </div>`;
  }

  // 组装区域 HTML
  let descCardsHtml = '';
  // 原始描述卡片
  if (hasOriginal) {
    descCardsHtml += renderDescCard({ text: t.desc }, true);
  }
  // 补充描述卡片列表
  for (const item of supplementList) {
    descCardsHtml += renderDescCard(item, false);
  }

  // 底部输入区：状态B 直接显示输入框，否则显示"我有补充"按钮（点击展开）
  let descInputHtml = '';
  if (showInputDirectly) {
    descInputHtml = `
      <div class="desc-supplement-input-row" id="descInputRow">
        <input id="descSupplementInput" class="desc-input" type="text" placeholder="如：B口出来右转50米、农贸市场二楼东侧" maxlength="50" />
        <button id="descSupplementBtn" class="report-btn" type="button">补充</button>
      </div>`;
  } else {
    // 有原始/补充描述时显示"我有补充"按钮，点击展开输入框
    descInputHtml = `
      <button id="descAddToggleBtn" class="desc-add-toggle-btn" type="button">✏️ 我有补充</button>
      <div class="desc-supplement-input-row desc-input-hidden" id="descInputRow">
        <input id="descSupplementInput" class="desc-input" type="text" placeholder="如：B口出来右转50米、农贸市场二楼东侧" maxlength="50" />
        <button id="descSupplementBtn" class="report-btn" type="button">补充</button>
      </div>`;
  }

  const descSupplementHtml = `
    <div class="report-section desc-supplement-section">
      <h3>补充位置描述（帮后来人找到它）</h3>
      ${descCardsHtml}
      ${descInputHtml}
    </div>`;

  body.innerHTML = `
    <div class="panel__title-row">
      <h2 class="panel__title">${t.name}</h2>
      <button id="navBtn" class="nav-btn" type="button" aria-label="导航前往" title="导航前往"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M21.71 11.29l-9-9a1 1 0 00-1.42 0l-9 9a1 1 0 000 1.42l9 9a1 1 0 001.42 0l9-9a1 1 0 000-1.42zM14 14.5V12h-4v3H8v-4a1 1 0 011-1h5V7.5l3.5 3.5z"/></svg></button>
    </div>
    ${addrHtml}
    <div class="meta">
      <span class="tag ${st.cls}">${st.emoji} ${st.label}</span>
      ${statusSub}
      <span class="tag ${src.cls}">${src.label}</span>
      ${old ? '<span class="tag old-warn">⚠️ 信息较旧</span>' : ''}
      ${labels.join('')}
    </div>
    <div class="info-row"><span class="k">评分</span><span class="v">${renderStars(t.rating)} ${t.rating.toFixed(1)}</span></div>
    <div class="info-row"><span class="k">可信度</span><span class="v">${Math.round(computeConfidence(t) * 100)}% <span style="font-size:11px;color:var(--text-sub);font-weight:400;">（来源${SOURCE_BASE[t.source]||0.5} + 确认${Math.min(0.3,((t.confirm_count||0)+(t.recovery_count||0))*0.1)} - 衰减${freshnessDecay(t.last_update)} + 评论${Math.min(0.1,(t.comments||[]).length*0.03)}）</span></span></div>
    <div class="info-row"><span class="k">最后更新</span><span class="v">${d === 0 ? '今天' : d + ' 天前'}</span></div>

    <div class="report-section">
      <h3>${reportTitle}</h3>
      <div class="report-btns">
        <div class="report-btn" data-report="open"><span class="emoji">🟢</span>${openBtnLabel}</div>
        <div class="report-btn" data-report="locked"><span class="emoji">🔴</span>已锁门</div>
        <div class="report-btn" data-report="repair"><span class="emoji">🟠</span>维修中</div>
        <div class="report-btn" data-report="removed"><span class="emoji">⚫</span>不存在</div>
      </div>
    </div>

    <div class="report-section">
      <h3>补充设施信息（确认有这些设施？点一下帮别人找）</h3>
      <div class="report-btns supplement-btns">
        ${renderSupplementBtn(t, 'accessible', '♿', '无障碍')}
        ${renderSupplementBtn(t, 'family', '👨‍👩‍👧', '第三卫生间')}
        ${renderSupplementBtn(t, 'water', '🚐', '房车水源')}
      </div>
    </div>

    ${descSupplementHtml}

    <div class="comments-section">
      <h3>评论评价（${t.comments.length}）</h3>
      <div class="comment-input">
        <select id="cRating"><option value="5">★★★★★</option><option value="4">★★★★</option><option value="3">★★★</option><option value="2">★★</option><option value="1">★</option></select>
        <input id="cText" type="text" placeholder="说点啥（如：B口出来右转就到）" />
        <button id="cSubmit">发布</button>
      </div>
      ${commentsHtml || '<div style="color:var(--text-sub);font-size:13px;">还没有评论，做第一个调查兵团成员</div>'}
    </div>
  `;

  body.querySelectorAll('.report-btn[data-report]').forEach(btn => {
    btn.addEventListener('click', () => {
      const newStatus = btn.dataset.report;
      // 统一持久化：任何点位（Mock/live/user）修改前先 ensurePersisted
      // 返回的是 userToilets 里的持久化对象引用，后续修改直接生效
      const p = ensurePersisted(t);
      const isRemoved = p.status === 'removed';

      if (newStatus === 'removed') {
        // 拆除报告：首次报告重置为1，重复确认累加
        if (p.status !== 'removed') {
          p.confirm_count = 1;
        } else {
          p.confirm_count = (p.confirm_count || 0) + 1;
        }
        p.last_removed_report_time = Date.now();
        p.status = 'removed';
        p.recovery_count = 0;
        p.last_recovery_report_time = null;
        const tier = removedTier(p);
        showToast(tier === 'confirmed' ? '已确认拆除（多人反馈），感谢你拯救下一条内裤' : '已记录疑似拆除，等待二次确认');
      } else if (newStatus === 'open' && isRemoved) {
        // 恢复链路：recovery_count++，confirm_count 重置（恢复后开放确认需重新累积）
        p.recovery_count = (p.recovery_count || 0) + 1;
        p.last_recovery_report_time = Date.now();
        p.status = 'open';
        p.confirm_count = 0;
        p.last_confirm_time = null;
        const rt = recoveryTier(p);
        showToast(rt === 'confirmed' ? '已确认恢复开放（多人复核），误报已清除' : '已记录疑似恢复，等待二次确认（单人复核不直接推翻拆除）');
      } else if (newStatus === 'open') {
        // 开放确认：分三种情况
        // 1. 疑似恢复中（recovery_count > 0 但未确认）：再次点开放 = 确认恢复（recovery_count++）
        // 2. 从锁门/维修恢复开放：重置计数器，确认人从1开始
        // 3. 已经是开放中：confirm_count++（pending→suspected→verified）
        if ((p.recovery_count || 0) === 1) {
          // 疑似恢复（recovery_count=1）→ 二次点击 = 确认恢复
          p.recovery_count = (p.recovery_count || 0) + 1;
          p.last_recovery_report_time = Date.now();
          p.confirm_count = p.recovery_count >= 2 ? 2 : 1; // 恢复确认后开放确认也同步
          if (p.recovery_count >= 2) p.last_confirm_time = Date.now();
          const rt = recoveryTier(p);
          showToast(rt === 'confirmed' ? '已确认恢复开放（多人复核），误报已清除' : '已记录疑似恢复，等待二次确认（单人复核不直接推翻拆除）');
        } else if (p.status === 'locked' || p.status === 'repair') {
          p.confirm_count = 1;
          p.recovery_count = 0;
          p.last_recovery_report_time = null;
          p.last_confirm_time = Date.now();
          p.status = 'open';
          showToast('已上报：已开放，感谢你拯救下一条内裤');
        } else {
          p.confirm_count = (p.confirm_count || 0) + 1;
          p.last_confirm_time = Date.now();
          p.status = 'open';
          showToast(p.confirm_count >= POINT_CONFIRM_THRESHOLD ? '已确认开放（多人确认）' : '已确认存在，等待二次确认');
        }
      } else {
        // 锁门/维修：状态变更，开放确认作废
        p.status = newStatus;
        p.confirm_count = 0;
        p.last_confirm_time = null;
        p.recovery_count = 0;
        p.last_recovery_report_time = null;
        showToast('已上报：' + STATUS_MAP[newStatus].label + '，感谢你拯救下一条内裤');
      }
      p.last_update = Date.now();
      saveUserToilets();
      renderMarkers();
      renderNearbyList();
      openPanel(p);
    });
  });

  /* 补充设施标签点击：按 data-action 分发（add 补充 / revoke 撤销）
     统一用 ensurePersisted 保证修改落在持久化对象上 */
  body.querySelectorAll('.supplement-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.supplement;
      const action = btn.dataset.action;
      const tagLabel = tag === 'accessible' ? '♿ 无障碍' : tag === 'family' ? '👨‍👩‍👧 第三卫生间' : '🚐 房车水源';

      // 持久化对象：直接修改
      // 非持久化对象（MOCK拷贝/live拷贝）：先 ensurePersisted 提升
      // 但 amap-live 点位的标签补充走 tagSupplements（坐标匹配），不 promote，
      // 因为 live 点位是临时搜索结果，下次搜索可能消失，用坐标匹配更可靠
      const isPersisted = t.id && t.id.startsWith('user_');
      const isLive = t.source === 'amap-live';

      if (action === 'add') {
        if (isPersisted) {
          // 已持久化：直接改对象
          t[tag] = true;
          t.last_update = Date.now();
          saveUserToilets();
          showToast('已补充：' + tagLabel);
        } else if (isLive) {
          // live 点位：走坐标匹配补充（count+1）
          addTagSupplement(t.lat, t.lng, tag);
          const status = getSupplementStatus(t, tag);
          showToast(status === 'confirmed'
            ? '已确认：' + tagLabel + '（多人补充）'
            : '已补充：' + tagLabel + '（待二次确认）');
        } else {
          // MOCK 点位（amap/amap+user/user 的浅拷贝）：提升到 userToilets
          const p = ensurePersisted(t);
          p[tag] = true;
          saveUserToilets();
          showToast('已补充：' + tagLabel + '（已纳入众包数据）');
          renderMarkers(); renderNearbyList();
          openPanel(p);
          return;
        }
      } else if (action === 'revoke') {
        if (isPersisted) {
          t[tag] = false;
          t.last_update = Date.now();
          saveUserToilets();
          showToast('已撤销：' + tagLabel);
        } else if (isLive) {
          removeTagSupplement(t.lat, t.lng, tag);
          showToast('已撤销：' + tagLabel);
        } else {
          // MOCK 拷贝上的撤销：说明之前补充过（走 tagSupplements），直接减 count
          removeTagSupplement(t.lat, t.lng, tag);
          showToast('已撤销：' + tagLabel);
        }
      }

      renderMarkers();
      renderNearbyList();
      openPanel(isPersisted ? t : (isLive ? t : t));  // 非 persist 非 live 已在上面 return
    });
  });

  /* 位置描述补充：点击"补充"按钮校验并提交
     逻辑：
     - 已持久化点位（user_）且 t.desc 为空：直接写 t.desc
     - 已持久化点位且 t.desc 已有：走 descSupplements 追加
     - amap-live 点位：走 descSupplements 坐标匹配，不 promote
     - Mock 点位且 t.desc 为空：先 ensurePersisted 提升，再写 p.desc
     - Mock 点位且 t.desc 已有：走 descSupplements 追加 */
  const descSupplementBtn = body.querySelector('#descSupplementBtn');
  if (descSupplementBtn) {
    descSupplementBtn.addEventListener('click', () => {
      const input = body.querySelector('#descSupplementInput');
      const val = input.value.trim();
      // 校验：非空、最少5字（与上报面板位置描述校验一致）
      if (!val) { showToast('请输入位置描述'); return; }
      if (val.length < 5) { showToast('位置描述至少 5 个字'); return; }

      const isPersisted = t.id && t.id.startsWith('user_');
      const isLive = t.source === 'amap-live';

      if (isPersisted) {
        if (!t.desc) {
          // 已持久化且无 desc：直接写 t.desc
          t.desc = val;
          t.last_update = Date.now();
          saveUserToilets();
          showToast('已补充位置描述');
        } else {
          // 已有 desc：走 descSupplements 追加新视角
          addDescSupplement(t.lat, t.lng, val);
          showToast('已补充位置描述（待二次确认）');
        }
        renderMarkers(); renderNearbyList();
        openPanel(t);
      } else if (isLive) {
        // live 点位：走坐标匹配补充
        addDescSupplement(t.lat, t.lng, val);
        showToast('已补充位置描述（待二次确认）');
        renderMarkers(); renderNearbyList();
        openPanel(t);
      } else {
        // Mock 点位
        if (!t.desc) {
          // 无 desc：先 ensurePersisted 提升，再写 p.desc
          const p = ensurePersisted(t);
          p.desc = val;
          p.last_update = Date.now();
          saveUserToilets();
          showToast('已补充位置描述');
          renderMarkers(); renderNearbyList();
          openPanel(p);
        } else {
          // 已有 desc：走 descSupplements 追加
          addDescSupplement(t.lat, t.lng, val);
          showToast('已补充位置描述（待二次确认）');
          renderMarkers(); renderNearbyList();
          openPanel(t);
        }
      }
    });
  }

  /* "我有补充"按钮：点击展开/收起输入框 */
  const descAddToggleBtn = body.querySelector('#descAddToggleBtn');
  if (descAddToggleBtn) {
    descAddToggleBtn.addEventListener('click', () => {
      const row = body.querySelector('#descInputRow');
      if (row) {
        row.classList.toggle('desc-input-hidden');
        if (!row.classList.contains('desc-input-hidden')) {
          // 展开时聚焦输入框
          const input = row.querySelector('#descSupplementInput');
          if (input) input.focus();
        }
      }
    });
  }

  /* "👍 描述准确"按钮：对该描述 count+1（confirmDescSupplement） */
  body.querySelectorAll('.desc-confirm-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const descText = btn.dataset.descConfirm;
      confirmDescSupplement(t.lat, t.lng, descText);
      // 查询更新后的状态
      const list = getDescSupplementList(t);
      const updated = list.find(d => d.text === descText);
      if (updated && updated.count === SUPPLEMENT_CONFIRM_THRESHOLD) {
        showToast('已确认位置描述（多人验证）');
      } else {
        showToast('感谢确认');
      }
      renderMarkers(); renderNearbyList();
      openPanel(t);
    });
  });

  /* "撤销"按钮：仅 pending&count=1 显示，移除该描述 */
  body.querySelectorAll('.desc-undo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const descText = btn.dataset.descUndo;
      const isPersisted = t.id && t.id.startsWith('user_');

      if (isPersisted && t.desc === descText) {
        // 已持久化点位且 t.desc 就是这条：清空 t.desc
        t.desc = '';
        t.last_update = Date.now();
        saveUserToilets();
      }
      // 走 descSupplements 撤销（对所有来源都调用）
      removeDescSupplement(t.lat, t.lng, descText);
      showToast('已撤销补充');
      renderMarkers(); renderNearbyList();
      openPanel(isPersisted ? t : t);
    });
  });

  const cSubmit = body.querySelector('#cSubmit');
  if (cSubmit) {
    cSubmit.addEventListener('click', () => {
      const rating = parseInt(body.querySelector('#cRating').value);
      const text = body.querySelector('#cText').value.trim();
      if (!text) { showToast('说点啥再发'); return; }
      const now = new Date();
      const time = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      // 评论也需要持久化：先 ensurePersisted 再操作
      const p = ensurePersisted(t);
      p.comments.unshift({ user: '你', rating, text, time });
      const sum = p.comments.reduce((a, c) => a + c.rating, 0);
      p.rating = sum / p.comments.length;
      p.last_update = Date.now();
      saveUserToilets();
      showToast('评论已发布');
      renderMarkers();
      renderNearbyList();
      openPanel(p);
    });
  }

  /* ============ 导航前往：底部 ActionSheet 选择高德/百度 ============ */
  const navBtn = body.querySelector('#navBtn');
  if (navBtn) {
    navBtn.addEventListener('click', () => showNavActionSheet(t));
  }

  document.getElementById('panel').classList.add('is-show', 'is-half');
  document.getElementById('panel').classList.remove('is-expanded');
  if (window.innerWidth < 768 && window._setPanelSnap) {
    window._setPanelSnap('half', false);
  }

  if (window.innerWidth < 768) {
    requestAnimationFrame(() => panToiletToVisibleArea(t));
    setTimeout(() => { if (currentToilet === t) panToiletToVisibleArea(t); }, 350);
  }
}

function panToiletToVisibleArea(t) {
  if (!t || !t.lat || !t.lng) return;
  if (isNaN(t.lat) || isNaN(t.lng)) return;
  if (!map || !map.getSize) return;
  const panelEl = document.getElementById('panel');
  const mapSize = map.getSize();
  if (!mapSize || !mapSize.x || !mapSize.y) return;
  // 用 getBoundingClientRect 计算面板真实可见顶部（反映 transform 动画状态）
  // 面板默认 translateY(calc(100%+20px)) 隐藏，动画中 rect.top > innerHeight
  const panelRect = panelEl.getBoundingClientRect();
  const mapRect = map.getContainer().getBoundingClientRect();
  // 面板顶部相对于地图容器的 Y 坐标（面板盖住地图底部，可见地图区域为 panelTopY 以上）
  const panelTopY = panelRect.top - mapRect.top;
  // 如果面板还没进入视口（动画刚开始）或面板在地图外，不做平移
  if (panelTopY <= 0 || panelTopY >= mapSize.y) return;
  // 给 POI 留 48px 安全边距（marker 高度+间距），确保完全在面板上方
  const safeY = panelTopY - 48;
  if (safeY <= 60) return; // 可见区域太小，不平移
  const currentPoint = map.latLngToContainerPoint([t.lat, t.lng]);
  if (!currentPoint || isNaN(currentPoint.x) || isNaN(currentPoint.y)) return;
  // 只向下平移地图（让 POI 向上移动到可见区）：如果 POI 已经在面板上方可见区域，不动
  if (currentPoint.y <= safeY) return;
  // 需要让 POI 上移到 safeY 位置 → 地图向下平移 → dy 为正
  const dy = currentPoint.y - safeY;
  const dx = Math.round(mapSize.x / 2) - currentPoint.x;
  if (isNaN(dx) || isNaN(dy)) return;
  if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
    map.panBy([dx, dy], { animate: true, duration: 0.3 });
  }
}

function closePanel() {
  // 移动端关闭面板时同步清理导航 ActionSheet，避免残留
  closeNavActionSheet();
  clearMarkerHighlight(); // 清除选中高亮
  const panel = document.getElementById('panel');
  if (window.innerWidth < 768 && window._closePanelMobile) {
    window._closePanelMobile();
    return;
  }
  panel.classList.remove('is-show', 'is-half', 'is-expanded');
  panel.style.transform = '';
  panel.style.transition = '';
  currentToilet = null;
  clearPickMode();
  document.getElementById('nearbyList').style.display = '';
}

/* ============ 导航前往 ActionSheet（MD3 Bottom Sheet 风格） ============ */
/* 检测微信内置浏览器（不可拉起原生 App，直接走网页版） */
function isWeixinBrowser() {
  return /MicroMessenger/i.test(navigator.userAgent);
}

/* 打开导航 ActionSheet：选择高德/百度地图拉起导航 */
function showNavActionSheet(t) {
  // 若已存在先移除，避免重复 DOM
  closeNavActionSheet();

  // 构造遮罩 + 底部 Sheet
  const overlay = document.createElement('div');
  overlay.className = 'nav-sheet-overlay';
  overlay.id = 'navSheetOverlay';

  const sheet = document.createElement('div');
  sheet.className = 'nav-sheet';
  sheet.innerHTML = `
    <div class="nav-sheet__handle" aria-hidden="true"></div>
    <div class="nav-sheet__title">选择导航地图</div>
    <button class="nav-sheet__item" data-map="amap" type="button">
      <span class="nav-sheet__icon">🗺️</span><span class="nav-sheet__label">高德地图</span>
    </button>
    <button class="nav-sheet__item" data-map="baidu" type="button">
      <span class="nav-sheet__icon">📍</span><span class="nav-sheet__label">百度地图</span>
    </button>
    <button class="nav-sheet__item nav-sheet__item--cancel" data-map="cancel" type="button">取消</button>
  `;
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  // 触发动画（下一帧加上 is-show，过渡到可见状态）
  requestAnimationFrame(() => overlay.classList.add('is-show'));

  // 点击遮罩关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeNavActionSheet();
  });

  // 选项点击：分发到对应地图
  sheet.querySelectorAll('.nav-sheet__item').forEach(btn => {
    btn.addEventListener('click', () => {
      const map = btn.dataset.map;
      if (map === 'cancel') {
        closeNavActionSheet();
        return;
      }
      launchMapNav(map, t);
      closeNavActionSheet();
    });
  });
}

/* 关闭导航 ActionSheet：移除 DOM */
function closeNavActionSheet() {
  const overlay = document.getElementById('navSheetOverlay');
  if (!overlay) return;
  overlay.classList.remove('is-show');
  // 等过渡动画结束再移除 DOM（200ms）
  setTimeout(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 220);
}

/* 拉起地图导航：移动端先试 URI Scheme，2s 未跳转则降级网页版；微信/PC 直接网页版 */
// GCJ-02（高德坐标系）转 BD-09（百度坐标系）
// 百度地图使用 BD-09 坐标系，直接传 GCJ-02 会偏移几十到几百米
// 转换公式：百度官方公开算法
function gcj02ToBd09(gcjLat, gcjLng) {
  const x = gcjLng, y = gcjLat;
  const z = Math.sqrt(x * x + y * y) + 0.00002 * Math.sin(y * Math.PI * 3000.0 / 180.0);
  const theta = Math.atan2(y, x) + 0.000003 * Math.cos(x * Math.PI * 3000.0 / 180.0);
  const bdLng = z * Math.cos(theta) + 0.0065;
  const bdLat = z * Math.sin(theta) + 0.006;
  return { lat: bdLat, lng: bdLng };
}

function launchMapNav(map, t) {
  const lat = t.lat;
  const lng = t.lng;
  const name = encodeURIComponent(t.name || '厕所');
  // 平台检测：iOS 与 Android 使用不同的高德导航 scheme
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  // 百度坐标转换：GCJ-02 → BD-09（避免百度地图偏移）
  const bd = gcj02ToBd09(lat, lng);

  // 网页版降级 URL（新标签页打开）
  let webUrl = '';
  if (map === 'amap') {
    // 高德网页版：position=lng,lat，coordinate=gaode 表示 GCJ-02
    webUrl = `https://uri.amap.com/marker?position=${lng},${lat}&name=${name}&src=厕哪&coordinate=gaode`;
  } else if (map === 'baidu') {
    // 百度网页版：location=lat,lng，coord_type=gcj02 由百度服务端转换
    // 但实测网页版 coord_type 参数可靠，可直接传 GCJ-02
    webUrl = `https://api.map.baidu.com/marker?location=${lat},${lng}&title=${name}&content=厕哪&output=html&coord_type=gcj02&src=厕哪`;
  } else {
    return;
  }

  // 微信内置浏览器 / 桌面端：直接打开网页版（无法拉起原生 App）
  if (isWeixinBrowser() || !('ontouchstart' in window)) {
    window.open(webUrl, '_blank');
    return;
  }

  // 移动端：构造 URI Scheme 拉起地图 App 显示 POI 标注（用户可点击进入详情页/发起导航）
  let scheme = '';
  if (map === 'amap') {
    // 高德 viewMap（地图标注）：Android 用 androidamap://，iOS 用 iosamap://
    // 坐标已是 GCJ-02，dev=0 表示无需偏移转换
    const prefix = isIOS ? 'iosamap' : 'androidamap';
    scheme = `${prefix}://viewMap?sourceApplication=${encodeURIComponent('厕哪')}&poiname=${name}&lat=${lat}&lon=${lng}&dev=0`;
  } else if (map === 'baidu') {
    // 百度 marker（地图打点）：baidumap://map/marker
    // 原生 App 的 coord_type 参数不可靠，直接传转换后的 BD-09 坐标
    scheme = `baidumap://map/marker?location=${bd.lat},${bd.lng}&title=${name}&content=${encodeURIComponent('厕哪')}&src=${encodeURIComponent('andr.cena.findtoilet')}`;
  }

  // 记录跳转前时间戳，2s 内未离开页面视为拉起失败
  let hidden = false;
  document.addEventListener('visibilitychange', function onVis() {
    if (document.hidden) hidden = true;
    document.removeEventListener('visibilitychange', onVis);
  });

  try {
    window.location.href = scheme;
  } catch (e) {}

  // 2 秒后检查是否仍停留在页面 → 降级网页版
  setTimeout(() => {
    if (!hidden && !document.hidden) {
      window.open(webUrl, '_blank');
    }
  }, 2000);
}

/* ============ 新增厕所点位上报（含真伪验证第 1 层） ============ */
async function openAddToiletPanel() {
  // 频率限制（24h 内 ≤5 个）
  if (!canReport()) { showToast('今日上报已达上限（5 个），明天再来'); return; }

  const body = document.getElementById('panelBody');
  // 默认坐标：用户当前位置（searchCenter，即 USER_LOC 或 GPS 定位结果）
  let pickCoords = [...searchCenter];

  // 进入拾取模式：放置可拖动图钉，点击/拖动实时更新坐标
  startPickMode(pickCoords, (newCoords) => {
    pickCoords = newCoords;
    const coordEl = body.querySelector('#pickCoord');
    if (coordEl) coordEl.textContent = pickCoords[0].toFixed(6) + ', ' + pickCoords[1].toFixed(6);
    // 50m 内已有点位检测（坐标变化时重新计算）
    updateNearbyHint();
  });

  // 50m 内已有点位检测（多楼层去重：提示而非拒绝）
  // 50m 内有重复时，位置描述升级为必填（用于区分同建筑不同楼层/区域）
  let hasNearbyDuplicate = false;
  function updateNearbyHint() {
    const nearby = getAllToilets().filter(t => {
      const d = haversine(pickCoords[0], pickCoords[1], t.lat, t.lng);
      return d <= 50;
    });
    hasNearbyDuplicate = nearby.length > 0;
    const hintEl = body.querySelector('#nearbyHint');
    if (hintEl) {
      hintEl.innerHTML = nearby.length > 0
        ? `⚠️ 50m 内已有【${nearby.map(t=>t.name).join('、')}】<br>若是同建筑不同楼层，<b>位置描述必填</b>（需含楼层/方位，如"3楼·B口右转"）；若重复请点<a id="goExist" style="color:var(--c-amap);cursor:pointer;">这里</a>补充情报`
        : '';
      // 重新绑定 goExist 点击事件
      const goExist = body.querySelector('#goExist');
      if (goExist) goExist.addEventListener('click', () => {
        closePanel();
        openPanel(nearby[0]);
      });
    }
  }

  body.innerHTML = `
    <h2>上报新厕所</h2>
    <div class="meta">
      <span class="tag source-user">众包情报</span>
      <span class="tag label">调查兵团贡献</span>
    </div>
    <div id="nearbyHint" style="background:#fffbe6;border:1px solid #ffe58f;border-radius:8px;padding:10px;margin-bottom:12px;font-size:13px;"></div>
    <div class="info-row"><span class="k">坐标</span><span class="v"><span id="pickCoord">${pickCoords[0].toFixed(6)}, ${pickCoords[1].toFixed(6)}</span><br><span style="font-size:11px;color:var(--text-sub);font-weight:400;">（拖动图钉或点击地图调整位置）</span></span></div>

    <div class="report-section">
      <h3>名称（必填）</h3>
      <input id="newName" type="text" placeholder="如：xx村公厕、xx医院内科诊区厕所" class="report-input" />
    </div>

    <div class="report-section">
      <h3>位置描述（必填，用于导航找厕所）<span id="descHint" style="font-weight:400;color:var(--text-hint);">至少 5 字</span></h3>
      <input id="newDesc" type="text" placeholder="如：村口大槐树后红砖房、3楼B口出来右转50米" class="report-input" />
    </div>

    <div class="report-section">
      <h3>当前状态</h3>
      <div class="report-btns">
        <div class="report-btn is-active" data-new-status="open"><span class="emoji">🟢</span>开放中</div>
        <div class="report-btn" data-new-status="locked"><span class="emoji">🔴</span>已锁门</div>
        <div class="report-btn" data-new-status="repair"><span class="emoji">🟠</span>维修中</div>
        <div class="report-btn" data-new-status="removed"><span class="emoji">⚫</span>不存在</div>
      </div>
    </div>

    <div class="report-section">
      <h3>标签（可多选）</h3>
      <div class="report-btns">
        <div class="report-btn" data-new-tag="accessible"><span class="emoji">♿</span>无障碍</div>
        <div class="report-btn" data-new-tag="family"><span class="emoji">👨‍👩‍👧</span>第三卫生间</div>
        <div class="report-btn" data-new-tag="water"><span class="emoji">🚐</span>房车水源</div>
      </div>
    </div>

    <div class="md3-submit-wrap">
      <button id="submitNewToilet" class="md3-btn md3-btn--filled" type="button">提交上报</button>
    </div>
  `;

  // 面板打开时隐藏周边列表
  collapseNearbyList();
  document.getElementById('nearbyList').style.display = 'none';

  // 初始化 50m 提示
  updateNearbyHint();

  // 状态选择（单选）
  let newStatus = 'open';
  body.querySelectorAll('[data-new-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      body.querySelectorAll('[data-new-status]').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      newStatus = btn.dataset.newStatus;
    });
  });

  // 标签选择（多选）
  const newTags = { accessible: false, family: false, water: false };
  body.querySelectorAll('[data-new-tag]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.newTag;
      newTags[tag] = !newTags[tag];
      btn.classList.toggle('is-active', newTags[tag]);
    });
  });

  // 提交（取图钉坐标 + 逆地理校验，第 1 层真伪验证）
  body.querySelector('#submitNewToilet').addEventListener('click', async () => {
    const name = body.querySelector('#newName').value.trim();
    const desc = body.querySelector('#newDesc').value.trim();
    if (!name) { showToast('请输入厕所名称'); return; }
    if (!desc) { showToast('请输入位置描述（帮人找到厕所）'); return; }
    if (desc.length < 5) { showToast('位置描述至少 5 字（如"村口大槐树后"）'); return; }
    // 50m 内有重复时，位置描述需含楼层/方位关键词（区分同建筑不同位置）
    if (hasNearbyDuplicate && !/(楼|层|F|f|口|门|侧|后|前|旁|东|西|南|北|左|右)/.test(desc)) {
      showToast('50m 内已有厕所，位置描述需含楼层或方位（如"3楼""B口右转"）');
      return;
    }

    // 取图钉坐标（拾取模式实时坐标）
    const finalCoords = getPickCoords() || pickCoords;
    const lat = finalCoords[0].toFixed(6);
    const lng = finalCoords[1].toFixed(6);

    const btn = body.querySelector('#submitNewToilet');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>校验坐标中...';

    // 围栏检查：本地判断，0 API 成本，比 regeo 更快
    // 围栏内：跳过 regeo（围栏本身已过滤海上/荒野）；围栏外：直接拒绝
    if (!isInGeofence(parseFloat(lat), parseFloat(lng))) {
      showToast('当前坐标超出 Demo 服务区（滨海新区），无法上报');
      btn.disabled = false; btn.innerHTML = '提交上报';
      return;
    }

    const newToilet = {
      id: 'user_' + Date.now(),
      name, desc, lat: parseFloat(lat), lng: parseFloat(lng),
      source: 'user', status: newStatus,
      accessible: newTags.accessible, family: newTags.family, water: newTags.water,
      rating: 0, last_update: Date.now(), created_by: 'you',
      // 上报者自己是第一个确认人：confirm_count=1（pending→suspected）
      // 报"不存在"也走疑似拆除链路（confirm_count=1，removedTier 判定 suspected）
      confirm_count: 1, last_confirm_time: Date.now(),
      recovery_count: 0, last_recovery_report_time: null,
      last_removed_report_time: newStatus === 'removed' ? Date.now() : null,
      comments: []
    };

    addUserToilet(newToilet);
    incrReportCount();
    // 先退出拾取模式再渲染（避免图钉被 renderMarkers 误清）
    clearPickMode();
    renderMarkers();
    renderNearbyList();
    closePanel();
    showToast('已上报：' + name + '（待核实，需2人确认）');
    setTimeout(() => openPanel(newToilet), 300);
  });

  document.getElementById('panel').classList.add('is-show', 'is-expanded');
  document.getElementById('panel').classList.remove('is-half');
  if (window.innerWidth < 768 && window._setPanelSnap) {
    window._setPanelSnap('expanded', false);
  }
}

window.panelHeightChanged = function() {
  if (window.innerWidth >= 768) return;
  const panel = document.getElementById('panel');
  if (!panel.classList.contains('is-show')) return;
  requestAnimationFrame(() => {
    if (currentToilet) panToiletToVisibleArea(currentToilet);
    // 面板高度变化时同步更新 nav-bar 位置
    if (window.updateNavBarPosition) window.updateNavBarPosition();
  });
};

/* ============ nav-bar 联动底部 Sheet 高度 ============ */
/* 面板 / 周边列表 打开或展开时，nav-bar 上浮到 Sheet 顶部上方，避免遮挡内容
   实现：通过 CSS 变量 --nav-bar-bottom 统一控制 nav-bar 和 legend-popup 的 bottom
   覆盖时机：MutationObserver 监听 panel + nearbyList class/style 变化，
            app.js 拖拽 move 中同步调用 */
function updateNavBarPosition() {
  // 桌面端 nav-bar 在右下角，不联动
  if (window.innerWidth >= 768) return;
  const panel = document.getElementById('panel');
  const list = document.getElementById('nearbyList');
  if (!panel || !list) return;

  const panelVisible = panel.classList.contains('is-show');
  const listCollapsed = list.classList.contains('is-collapsed');
  // display:none 的元素 getBoundingClientRect 返回全0，需要额外排除
  const listHidden = list.style.display === 'none';

  // 所有 Sheet 都关闭/收起：回到默认底部位置
  if (!panelVisible && (listCollapsed || listHidden)) {
    document.documentElement.style.removeProperty('--nav-bar-bottom');
    return;
  }

  // 取两个 Sheet 中更靠近视口顶部（top 更小）的那个作为上浮基准
  // 用 getBoundingClientRect().top 获取元素真实可见位置（反映 transform 动画状态）
  let top = window.innerHeight;
  if (panelVisible) {
    const pr = panel.getBoundingClientRect();
    // 只有当面板真正进入视口（top < innerHeight）时才参与计算
    if (pr.top < top && pr.top < window.innerHeight) top = pr.top;
  }
  if (!listCollapsed && !listHidden) {
    const lr = list.getBoundingClientRect();
    if (lr.top < top && lr.top < window.innerHeight) top = lr.top;
  }

  // nav-bar 放在 Sheet 顶部上方 8px 间距
  const visibleHeight = window.innerHeight - top;
  document.documentElement.style.setProperty('--nav-bar-bottom', `${visibleHeight + 8}px`);
}

// 监听 panel 和 nearbyList 的 class/style 变化（覆盖 setSnap、openPanel、closePanel、列表展开/收起等）
const _sheetObserver = new MutationObserver(() => updateNavBarPosition());
_sheetObserver.observe(document.getElementById('panel'), { attributes: true, attributeFilter: ['class', 'style'] });
_sheetObserver.observe(document.getElementById('nearbyList'), { attributes: true, attributeFilter: ['class', 'style'] });

// panel transform/max-height transition 结束后重新计算（动画过程中 getBoundingClientRect 不稳定）
document.getElementById('panel').addEventListener('transitionend', (e) => {
  if (e.propertyName === 'transform' || e.propertyName === 'max-height') {
    updateNavBarPosition();
  }
});
// nearby-list max-height transition 结束后重新计算
document.getElementById('nearbyList').addEventListener('transitionend', (e) => {
  if (e.propertyName === 'max-height') {
    updateNavBarPosition();
  }
});

// 窗口尺寸变化时重算（如旋转屏幕）
window.addEventListener('resize', updateNavBarPosition);

/* ============ snap 过渡期间持续同步 nav-bar 位置 ============ */
/* 列表/面板 snap 动画期间，用 rAF 循环每帧更新 CSS 变量，
   同时禁用 nav-bar 自身的 bottom transition，避免 nav-bar 慢半拍。
   duration 后自动停止循环并恢复 transition。 */
let _navSyncRafId = null;
window.syncNavBarDuringTransition = function(duration) {
  if (window.innerWidth >= 768) return; // 桌面端不联动
  document.body.classList.add('is-dragging-sheet'); // 禁用 nav-bar bottom transition
  if (_navSyncRafId) cancelAnimationFrame(_navSyncRafId);
  const start = performance.now();
  function tick() {
    updateNavBarPosition();
    if (performance.now() - start < duration) {
      _navSyncRafId = requestAnimationFrame(tick);
    } else {
      _navSyncRafId = null;
      document.body.classList.remove('is-dragging-sheet');
      updateNavBarPosition();
    }
  }
  _navSyncRafId = requestAnimationFrame(tick);
};

// 暴露给 app.js 拖拽过程中同步调用（MutationObserver 是异步微任务，拖拽时需同步更新避免延迟）
window.updateNavBarPosition = updateNavBarPosition;

// 初始调用：页面加载时 nearby-list 默认展开，MutationObserver 不会触发初始状态
// 延迟一帧确保 DOM 布局完成
requestAnimationFrame(() => updateNavBarPosition());
