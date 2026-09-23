/* ============================================================
   拍照参考软件 · 生成引擎 + 界面
   纯前端、无依赖、双击 index.html 即用，数据存本地。
   ============================================================ */

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rnd = a => a[Math.floor(Math.random() * a.length)];

/* ---------- 英文关键词（给 Pinterest / Instagram 用） ---------- */
const EN_SUBJECT = {
  coffee:'flat lay coffee', tea:'iced drink aesthetic', breakfast:'breakfast flat lay',
  dessert:'cake still life', homecook:'home cooked meal', desk:'desk setup aesthetic',
  bedroom:'bedroom interior cozy', washstand:'bathroom vanity', plants:'flower still life',
  ootd:'ootd street style', selfie:'portrait photography', pet:'pet portrait',
  hands:'hands aesthetic', cafestore:'cafe interior', street:'street photography',
  travel:'travel landscape', nightlight:'night city lights', market:'market produce',
  products:'product photography', makeup:'makeup flat lay', book:'book aesthetic'
};

/* ---------- 状态 ---------- */
const LS_LAST = 'paizhao_last_v1', LS_FAVS = 'paizhao_favs_v1';
let ST = {
  subjectText:'咖啡', env:'home-desk', light:'win-soft', style:'milk',
  device:'phone', props:['linen','wood','plant']
};
let PLAN = null, TAB = 'shots';
/* 真实封面图数据（由 fetch_refs.py 生成 refs.js 注入；没有就是 null，走深链降级）。
   注意：这里用 let 声明（不挂 window），外部必须走下面的 setRefsData() 注入，
   直接 window.REFS = x 是赋给另一个全局属性，闭包读不到 —— 已经踩过一次。 */
let REFS = null;
/* 封面墙当前展示条数（点「展开」变大） */
let WALL_SHOW = 12;
/* 给 index.html 里的 refs.js 加载器用的注入口。
   PLAN 还没生成时（手机版数据在 app.js 之前就内联好了）也要能渲染 —— 
   那时 render() 会自己调 generate()，所以直接用 DOM 里有没有结果区来判断。 */
function setRefsData(d){
  if (!d || !d.items || !d.items.length) return;
  REFS = d;
  if (PLAN || document.getElementById('refs')) render();
}

/* ---------- 轻量匹配：把用户输入对上库里的主体 ---------- */
const SCENE_HINT = [
  {t:'drink', w:['咖啡','拿铁','茶','奶茶','饮','酒','汽水','果汁','美式','手冲','杯']},
  {t:'food', w:['早餐','brunch','午餐','晚餐','甜品','蛋糕','甜点','面包','饭','面','菜','食','甜品','饺子','便当','锅']},
  {t:'portrait', w:['人','自己','穿搭','ootd','自拍','脸','猫','狗','宠物','娃','宝宝','身']},
  {t:'outdoor', w:['街','路','城市','旅行','景','山','海','天','云','夜','灯','市集','超市','车站','建筑','公园']},
  {t:'table', w:['桌','书','笔','静物','好物','产品','化妆','护肤','花','植物','床','洗手','瓶']}
];

function matchSubject(text){
  const t = (text || '').trim();
  if (!t) return SUBJECTS[0];
  let best = null, score = 0;
  SUBJECTS.forEach(s => {
    let sc = 0;
    if (s.name.indexOf(t) >= 0 || t.indexOf(s.name) >= 0) sc += 100;
    (s.kw || []).forEach(k => { if (t.indexOf(k) >= 0 || k.indexOf(t) >= 0) sc += 40; });
    s.name.split(/[\s/·]+/).forEach(w => { if (w && t.indexOf(w) >= 0) sc += 20; });
    if (sc > score){ score = sc; best = s; }
  });
  if (best && score > 0) return best;

  // 库里没有 → 按语义猜场景类型，用通用模板兜底
  let sceneType = 'table';
  outer: for (const h of SCENE_HINT){
    for (const w of h.w){ if (t.indexOf(w) >= 0){ sceneType = h.t; break outer; } }
  }
  const generic = {
    drink:{place:['杯口朝 10 点钟方向，不要正对镜头','杯后放一个矮一点的配角，制造前后层次','桌面留 1/3 空白，别放正中间'],
      props:['木托盘','亚麻布','小勺','干花'], shot:['俯拍平铺','45 度带杯口','平视 + 手入镜','俯拍 + 脚入镜']},
    food:{place:['盘子摆成三角，别摆成一排','高的东西放后面，扁的放前面','留一块空白，别塞满','出现桌沿或桌角，画面立刻有空间感'],
      props:['白瓷盘','餐巾刀叉','木砧板','一杯饮料'], shot:['俯拍平铺','45 度餐桌全景','近景特写','带手部动作']},
    table:{place:['先定一条水平基准线，其他东西对齐它','东西分主用/陪衬/装饰三组','只留 3–5 件，留白 ≥ 40%'],
      props:['亚麻布','木质托盘','绿植','书'], shot:['俯拍平铺','45 度斜侧','正面平视','材质细节特写']},
    portrait:{place:['人放左或右 1/3，视线方向留空白','机位放到腰的高度，别从眼睛高度平推','脚和头顶不要贴着画幅边缘'],
      props:['一面干净的墙','镜子','一杯饮料'], shot:['半身人像','特写/侧脸','背影/剪影','局部细节']},
    outdoor:{place:['地平线放上 1/3 或下 1/3，不要放正中间','找前景做层次，别只有远景','等一个干净的空档再按快门'],
      props:['地面积水/倒影','门框栏杆','招牌字'], shot:['大场景','中景（主体+环境）','画框式构图','贴地低角度']}
  }[sceneType];

  return {
    id:'custom', name:t, kw:[t], sceneType,
    place: generic.place, props: generic.props, shot: generic.shot,
    avoid:['画面里元素超过 5 件就会显乱，先做减法','拍之前先擦干净/清空桌面，背景比主体更容易毁照片','颜色超过 4 种就减掉一种'],
    photo:['同一个场景至少拍 3 个机位：俯拍、45 度、平视','每个机位连拍 3 张，选一张最清楚的']
  };
}

/* ---------- 道具匹配：按风格给建议 ---------- */
function propsForStyle(styleId){
  return PROPS.filter(p => p.styles.indexOf(styleId) >= 0);
}

/* ---------- 调色数值合并（风格基础 + 光线修正） ---------- */
function mergeGrade(style, light){
  const basic = Object.assign({}, style.grade.basic);
  Object.keys(light.adjust).forEach(k => { basic[k] = (basic[k] || 0) + light.adjust[k]; });
  return basic;
}
function fmt(key, v){
  const s = Math.abs(v) < 0.005 ? '0' : (v > 0 ? '+' : '') + (Math.abs(v) < 1 && key === '曝光度' ? v.toFixed(2) : Math.round(v));
  return s;
}
function topMoves(basic){
  return Object.keys(basic)
    .filter(k => k !== '曝光度' || Math.abs(basic[k]) > 0.05)
    .sort((a, b) => Math.abs(basic[b]) - Math.abs(basic[a]))
    .slice(0, 4)
    .map(k => ({ k, v: fmt(k, basic[k]) }));
}

/* ---------- 关键词生成 ---------- */
function buildKeywords(subj, style, light, env){
  const s = subj.kw[0] || subj.name;
  const st = KW_STYLE[style.id] || style.name;
  const list = [
    s + ' 摆拍 构图',
    s + ' ' + (subj.sceneType === 'portrait' || subj.sceneType === 'outdoor' ? '机位 角度' : '俯拍 平铺'),
    s + ' ' + st.split(' ')[0] + ' 调色',
    s + ' 滤镜参数',
    env.sk + ' ' + s + ' 怎么拍',
    st + ' 拍照 氛围感',
    s + ' 道具 陈列',
    s + ' plog'
  ];
  const en = EN_SUBJECT[subj.id];
  if (en) list.push(en);
  return list;
}

/* ---------- 主生成 ---------- */
function generate(){
  const subj = matchSubject(ST.subjectText);
  const env = ENVS.find(e => e.id === ST.env) || ENVS[0];
  const light = LIGHTS.find(l => l.id === ST.light) || LIGHTS[0];
  const style = STYLES.find(s => s.id === ST.style) || STYLES[0];
  const device = ST.device;

  // 主体声明的机位偏好 = 模板名的不完整写法，用「包含」匹配；匹配不到 2 个就退回该场景的全部机位
  const allShots = SHOTS[subj.sceneType] || SHOTS.table;
  let matched = allShots.filter(sh => subj.shot.some(x => sh.name.indexOf(x) >= 0));
  if (matched.length < 2) matched = allShots;
  const finalShots = matched.slice(0, 3);

  const basic = mergeGrade(style, light);

  const diag = [];
  const push = (id, why) => diag.push(Object.assign({}, DIAGNOSIS.find(d => d.id === id), { why }));
  push('tilt', '只要画面里有水平线（桌沿/地平线），歪了就一定显业余');
  if (['home-led','night-lamp'].indexOf(light.id) >= 0 || ['market','store'].indexOf(env.id) >= 0)
    push('dirty', '当前光线（' + light.name + '）是白平衡最容易错的一种，先改色温再谈美感');
  if (['night-lamp','neon'].indexOf(light.id) >= 0) push('dark', '夜晚拍摄最容易欠曝，先保证亮部有细节');
  if (['win-soft','overcast','home-led'].indexOf(light.id) >= 0) push('flat', '散射光/顶灯天生没反差，必须靠侧光或补光做立体感');
  push('messy', ST.props.length >= 4 ? '你选了 ' + ST.props.length + ' 样道具，已经到「乱」的临界点' : '这是最常见的问题，先做减法');
  if (['dopamine'].indexOf(style.id) >= 0) push('full', '高饱和风格必须靠留白呼吸，塞满就变廉价');
  else push('full', '留白不够是静物图显 low 的第一原因');

  const titles = [
    TITLE_TPL[0]({ subj: subj.name, n: 3 + Math.floor(Math.random() * 40) }),
    TITLE_TPL[1]({ subj: subj.name, styleName: style.name.split(' ')[0] }),
    TITLE_TPL[3]({ subj: subj.name, n: finalShots.length })
  ];

  const tags = []
    .concat(subj.kw.slice(0, 2).map(k => '#' + k))
    .concat(style.hashtags.slice(0, 4))
    .concat(['#' + env.name.split(/[\s/]+/)[0], '#' + light.name.split(/[\s/]+/)[0]])
    .concat(TAGS_COMMON.slice(0, 2))
    .filter((v, i, a) => a.indexOf(v) === i).slice(0, 10);

  const dev = device === 'phone' ? [
    '用 2x / 3x 变焦代替「走近拍」：畸变小、能切掉杂物',
    '关掉「AI 美颜 / 自动美化 / 场景优化」，它们会自动加饱和和锐化，把画面搞脏',
    '相机 App 里打开网格线 + 关掉闪光灯',
    '拍完用 Lightroom 手机版（免费）调，别用系统相册自带的滤镜',
    '专业模式里白平衡手动定一个值（比如 5000K），同一个场景所有照片颜色才统一',
    '静物尽量别手持：书堆垫高当三脚架，或用耳机线当快门线'
  ] : [
    '35mm 或 50mm 定焦最适合静物/plog（手机 2x 就是 50mm 的视角）',
    '光圈 f/2.8–f/4 拍静物，景深够又有虚化；拍产品 f/5.6–f/8 保证全清',
    '同一组照片固定白平衡（K 值），后期套同一个预设才能统一色调',
    '拍 RAW，后期空间比 JPG 大得多',
    '拍暗调就把 ISO 压到 400 以内，宁可慢快门'
  ];

  PLAN = {
    subj, env, light, style, device, basic, shots: finalShots,
    propAdvice: propsForStyle(style.id),
    chosenProps: ST.props.map(id => PROPS.find(p => p.id === id)).filter(Boolean),
    diag, titles, tags,
    keywords: buildKeywords(subj, style, light, env),
    devTips: dev,
    moves: topMoves(basic)
  };
  return PLAN;
}

/* ============================================================
   渲染
   ============================================================ */

function paletteBar(cls, colors, h){
  h = h || 26;
  return '<div class="palette ' + (cls || '') + '">' + colors.map(c =>
    '<i style="background:' + c + ';height:' + h + 'px" title="' + c + '"></i>').join('') + '</div>';
}

/* --- 俯视构图示意图 --- */
const KIND_STYLE = {
  subject:{ s:'#E8B96A', f:'rgba(232,185,106,.18)' },
  prop:{ s:'#7FA6C8', f:'rgba(127,166,200,.14)' },
  negative:{ s:'#6E6E76', f:'rgba(255,255,255,.03)' },
  fill:{ s:'#9C8F7A', f:'rgba(156,143,122,.13)' }
};
function svgTop(layout){
  const W = 264, H = 352;   // 3:4
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="wire" role="img" aria-label="构图示意">';
  s += '<rect x="0.5" y="0.5" width="' + (W - 1) + '" height="' + (H - 1) + '" rx="8" fill="#141416" stroke="#33333a"/>';
  // 三分线
  [1 / 3, 2 / 3].forEach(f => {
    s += '<line x1="' + (W * f).toFixed(1) + '" y1="0" x2="' + (W * f).toFixed(1) + '" y2="' + H + '" stroke="rgba(255,255,255,.09)" stroke-dasharray="3 4"/>';
    s += '<line x1="0" y1="' + (H * f).toFixed(1) + '" x2="' + W + '" y2="' + (H * f).toFixed(1) + '" stroke="rgba(255,255,255,.09)" stroke-dasharray="3 4"/>';
  });
  // 交叉点
  [1 / 3, 2 / 3].forEach(a => [1 / 3, 2 / 3].forEach(b => {
    s += '<circle cx="' + (W * a).toFixed(1) + '" cy="' + (H * b).toFixed(1) + '" r="2.5" fill="rgba(232,185,106,.55)"/>';
  }));
  layout.items.forEach(it => {
    const st = KIND_STYLE[it.kind] || KIND_STYLE.prop;
    const x = it.x * W, y = it.y * H, w = it.w * W, h = it.h * H;
    const dash = it.kind === 'subject' ? '' : (it.kind === 'negative' ? 'stroke-dasharray="2 4"' : 'stroke-dasharray="5 4"');
    s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="5" fill="' + st.f + '" stroke="' + st.s + '" stroke-width="' + (it.kind === 'subject' ? 1.8 : 1.2) + '" ' + (dash ? dash : '') + '/>';
    // 折行标签
    const maxCh = Math.max(4, Math.floor(w / 10.5));
    const lines = [];
    for (let i = 0; i < it.label.length; i += maxCh) lines.push(it.label.slice(i, i + maxCh));
    const show = lines.slice(0, 2);
    show.forEach((ln, i) => {
      s += '<text x="' + (x + 6).toFixed(1) + '" y="' + (y + 14 + i * 11).toFixed(1) + '" font-size="9.5" fill="' + st.s + '" font-family="system-ui,sans-serif">' + esc(ln) + '</text>';
    });
  });
  // 图例
  const legend = [['subject','主摄体'],['prop','配角'],['negative','留白'],['fill','背景/桌面']];
  let lx = 12;
  s += '<text x="12" y="' + (H - 22) + '" font-size="9" fill="#4d4d55" font-family="system-ui,sans-serif">手机取景框 3:4 · 虚线＝三分线</text>';
  legend.forEach(l => {
    const st = KIND_STYLE[l[0]];
    s += '<rect x="' + lx + '" y="' + (H - 16) + '" width="8" height="8" rx="2" fill="' + st.f + '" stroke="' + st.s + '" stroke-width="1"/>';
    s += '<text x="' + (lx + 12) + '" y="' + (H - 8) + '" font-size="9" fill="' + st.s + '" font-family="system-ui,sans-serif">' + l[1] + '</text>';
    lx += 12 + l[1].length * 9 + 12;
  });
  s += '</svg>';
  return s;
}

/* --- 侧视机位图 --- */
function parseAngle(txt){
  const m = String(txt).match(/-?\d+\s*°/);
  if (m) return Math.max(-45, Math.min(90, parseInt(m[0], 10)));
  if (/俯拍|俯视|垂直朝下/.test(txt)) return 90;
  if (/仰|贴地|从下往上/.test(txt)) return -25;
  if (/略低|低角度/.test(txt)) return -12;
  if (/45/.test(txt)) return 45;
  return 0;
}
function svgSide(shot){
  const W = 264, H = 168, TX = 132, TY = 124;   // 桌面线
  const deg = parseAngle(shot.angle);
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="wire" role="img" aria-label="机位示意">';
  s += '<rect x="0.5" y="0.5" width="' + (W - 1) + '" height="' + (H - 1) + '" rx="8" fill="#141416" stroke="#33333a"/>';
  // 桌面 + 主体
  s += '<line x1="14" y1="' + TY + '" x2="' + (W - 14) + '" y2="' + TY + '" stroke="#5a5a63" stroke-width="1.5"/>';
  s += '<rect x="' + (TX - 22) + '" y="' + (TY - 40) + '" width="44" height="40" rx="4" fill="rgba(232,185,106,.18)" stroke="#E8B96A" stroke-width="1.6"/>';
  s += '<text x="' + (TX - 20) + '" y="' + (TY - 24) + '" font-size="9" fill="#E8B96A" font-family="system-ui,sans-serif">主体</text>';
  // 相机位置（极坐标，从主体顶部出发）
  const R = 88, rad = deg * Math.PI / 180;
  let cx = TX + R * Math.cos(rad), cy = (TY - 30) - R * Math.sin(rad);
  cy = Math.max(22, Math.min(H - 26, cy));
  s += '<line x1="' + cx.toFixed(1) + '" y1="' + cy.toFixed(1) + '" x2="' + TX + '" y2="' + (TY - 22) + '" stroke="rgba(127,166,200,.6)" stroke-dasharray="4 3" stroke-width="1.2"/>';
  // 角度弧
  s += '<path d="M ' + (TX - 46) + ' ' + (TY - 30) + ' A 40 40 0 0 1 ' + (TX - 40 * Math.cos(rad)).toFixed(1) + ' ' + (TY - 30 - 40 * Math.sin(rad)).toFixed(1) + '" fill="none" stroke="rgba(232,185,106,.5)" stroke-width="1.2"/>';
  // 相机
  s += '<g transform="translate(' + cx.toFixed(1) + ',' + cy.toFixed(1) + ') rotate(' + (-deg) + ')">';
  s += '<rect x="-15" y="-11" width="30" height="22" rx="4" fill="#242429" stroke="#7FA6C8" stroke-width="1.4"/>';
  s += '<circle cx="7" cy="0" r="5.5" fill="#141416" stroke="#7FA6C8" stroke-width="1.2"/>';
  s += '<rect x="-12" y="-15" width="10" height="5" rx="1.5" fill="#242429" stroke="#7FA6C8" stroke-width="1"/>';
  s += '</g>';
  s += '<text x="14" y="' + (H - 10) + '" font-size="9.5" fill="#9a9aa2" font-family="system-ui,sans-serif">机位：' + esc(shot.angle) + ' ｜ 距离：' + esc(shot.dist) + '</text>';
  s += '</svg>';
  return s;
}

/* --- 单条拍摄方案卡 --- */
function shotCard(sh, i){
  return '<article class="shot">' +
    '<header><span class="idx">' + (i + 1) + '</span><h4>' + esc(sh.name) + '</h4>' +
    '<span class="tagline">' + esc(sh.best) + '</span></header>' +
    '<div class="shot-grid">' +
      svgTop(sh.layout) +
      '<div class="shot-info">' +
        svgSide(sh) +
        '<dl class="meta">' +
          '<dt>焦距</dt><dd>' + esc(sh.focal) + '</dd>' +
          '<dt>主体占比</dt><dd>' + esc(sh.share) + '</dd>' +
          '<dt>用光</dt><dd>' + esc(sh.light) + '</dd>' +
        '</dl>' +
      '</div>' +
    '</div>' +
    '<ul class="tips">' + sh.tips.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' +
    '</article>';
}

/* --- 摆法（物品摆放方法） --- */
function renderPlace(p){
  return '<div class="card">' +
    '<div class="col">' +
      '<h3>① 摆放方法 <small>物品怎么放、放哪里</small></h3>' +
      '<ol class="num">' + p.subj.place.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol>' +
      '<h3>② 拍摄主体怎么处理</h3>' +
      '<ul class="dot">' + p.subj.photo.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
    '</div>' +
    '<div class="col">' +
      '<h3>③ 该摆什么道具</h3>' +
      '<div class="chips">' + p.subj.props.map(x => '<span class="chip">' + esc(x) + '</span>').join('') + '</div>' +
      '<h3>④ ' + esc(p.style.name.split(' ')[0]) + ' 风格推荐道具</h3>' +
      '<ul class="prop-list">' + p.propAdvice.slice(0, 6).map(x =>
        '<li><b>' + esc(x.name) + '</b><span>' + esc(x.use.join('；')) + '</span></li>').join('') + '</ul>' +
    '</div>' +
  '</div>' +
  '<div class="card warn">' +
    '<h3>⑤ 这些东西放了就翻车</h3>' +
    '<ul class="dot bad">' + p.subj.avoid.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
  '</div>';
}

/* --- 调色 --- */
function renderColor(p){
  const g = p.style.grade;
  const rows = Object.keys(p.basic).map(k => {
    const v = p.basic[k], sv = p.style.grade.basic[k] || 0, delta = v - sv;
    const w = Math.min(48, Math.abs(v) * (k === '曝光度' ? 48 : 0.48)) || 1.5;
    return '<tr><th>' + esc(k) + '</th><td class="val">' + fmt(k, v) + '</td>' +
      '<td class="bar"><span class="' + (v >= 0 ? 'up' : 'down') + '" style="width:' + w.toFixed(1) + '%"></span></td>' +
      '<td class="delta">' + (Math.abs(delta) > 0.01 ? '（光线修正 ' + fmt(k, delta) + '）' : '') + '</td></tr>';
  }).join('');

  const hsl = g.hsl.map(h => {
    const cs = { '红':['#d9534f','#c9302c'],'橙':['#e08b3c','#c9762c'],'黄':['#e6c34a','#d1ad33'],'绿':['#5aa469','#4a8f58'],'青':['#4fa8a0','#3f968e'],'蓝':['#4a7fd1','#3a6ec0'] }[h.ch] || ['#888','#666'];
    return '<tr><th><i class="sw" style="background:' + cs[0] + '"></i>' + h.ch + '</th>' +
      '<td>' + fmt('', h.h) + '</td><td>' + fmt('', h.s) + '</td><td>' + fmt('', h.l) + '</td></tr>';
  }).join('');

  const sp = g.split;
  const hc = 'hsl(' + sp.high.h + ', ' + (30 + sp.high.s) + '%, 72%)';
  const sc = 'hsl(' + sp.shadow.h + ', ' + (25 + sp.shadow.s) + '%, 42%)';

  return '<div class="steps">' + p.moves.map((m, i) =>
      '<div class="step"><span>' + (i + 1) + '</span><div><b>' + esc(m.k) + ' ' + m.v + '</b><small>' + esc(STEP_NOTE[m.k] || '') + '</small></div></div>'
    ).join('') + '</div>' +
  '<div class="card note">先做上面这几步，画面就有 80 分了；下面的是精修参数。</div>' +
  '<div class="card">' +
    '<h3>基础面板（Lightroom 手机版 · 亮度/颜色）</h3>' +
    '<table class="grade"><thead><tr><th>参数</th><th>数值</th><th></th><th></th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<p class="hint">负值 = 往左拉，正值 = 往右拉。虚线左侧为负、右侧为正。</p>' +
  '</div>' +
  '<div class="card">' +
    '<h3>颜色分级（原「分离色调」）</h3>' +
    '<div class="split-tone">' +
      '<div><i style="background:' + hc + '"></i><b>高光</b><small>色相 ' + sp.high.h + ' · 饱和度 ' + sp.high.s + '</small></div>' +
      '<div><i style="background:' + sc + '"></i><b>阴影</b><small>色相 ' + sp.shadow.h + ' · 饱和度 ' + sp.shadow.s + '</small></div>' +
    '</div>' +
    '<h3>混色 HSL（色相 / 饱和度 / 明度）</h3>' +
    '<table class="grade hsl"><thead><tr><th>颜色</th><th>色相</th><th>饱和</th><th>明度</th></tr></thead><tbody>' + hsl + '</tbody></table>' +
    '<p class="hint">HSL 是这套风格的「味道来源」：把黄的饱和压下去、明度提上来，就是食物的奶油感。</p>' +
  '</div>' +
  '<div class="card">' +
    '<h3>曲线 / 效果</h3>' +
    '<ul class="dot"><li>' + esc(g.curve.note) + '</li></ul>' +
    '<table class="grade"><tbody>' + Object.keys(g.effects).map(k =>
      '<tr><th>' + esc(k) + '</th><td class="val">' + fmt('', g.effects[k]) + '</td><td colspan="2" class="hint">' + esc(EFFECT_NOTE[k] || '') + '</td></tr>').join('') +
    '</tbody></table>' +
    '<p class="hint">懒得调这么多？' + esc(p.style.filters) + '。滤镜只是起点，调完再按上面的数值微调一次。</p>' +
  '</div>';
}
const STEP_NOTE = {
  '曝光度':'先定整体亮度，别在暗的时候硬拉其他参数',
  '对比度':'加对比 = 去灰；减对比 = 变柔',
  '高光':'往左拉救回杯口/窗边的死白',
  '阴影':'往右拉让暗部有细节，但拉太多会发灰',
  '白色色阶':'控制「最亮的那一档」，白色物品要保住',
  '黑色色阶':'控制「最暗的那一档」，压下去画面才不飘',
  '色温':'往右暖、往左冷；黄绿发闷就往左拉',
  '色调':'往右偏洋红、往左偏绿；纠正 LED 灯的绿',
  '自然饱和度':'只加不鲜艳的颜色，比「饱和度」安全',
  '饱和度':'全局加饱和，最容易过头'
};
const EFFECT_NOTE = { '纹理':'加清晰度但只作用于细节，比清晰度自然','清晰度':'加质感/去灰；负值就是柔焦','去朦胧':'加通透、去灰雾','暗角':'四周压暗，把视线逼到中间','颗粒':'加胶片感，15–25 最像胶片' };

/* --- 爆款逻辑 --- */
function renderLogic(p){
  const s = p.style;
  return '<div class="card">' +
    '<h3>这个人人都说好看，好看在哪</h3>' +
    '<p class="why">' + esc(s.why) + '</p>' +
    '<div class="kv"><span>适合场景</span><b>' + esc(p.subj.name) + ' · ' + esc(p.env.name) + '</b></div>' +
    '<div class="kv"><span>光线上怎么配</span><b>' + esc(s.light) + '</b></div>' +
  '</div>' +
  '<div class="grid2">' +
    '<div class="card"><h3>构图习惯（爆款都这么构）</h3><ul class="dot">' + s.compo.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' +
    '<div class="card"><h3>道具与陈列</h3><ul class="dot">' + s.styling.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' +
  '</div>' +
  '<div class="card warn"><h3>这套风格的翻车点</h3><ul class="dot bad">' + s.pitfalls.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' +
  '<div class="card"><h3>配色盘（照着这个色系买东西/挑衣服）</h3>' + paletteBar('', s.palette, 40) +
    '<div class="hexrow">' + s.palette.map(c => '<code>' + c + '</code>').join('') + '</div>' +
    '<p class="hint">画面里的颜色控制在这个色盘 ±1 个肤色/食物色之内，就基本不会土。</p>' +
  '</div>' +
  '<div class="card"><h3>你的照片为什么不好看（按你这次的设置排序）</h3>' +
    '<div class="diag">' + p.diag.slice(0, 4).map(d =>
      '<div class="diag-item"><span class="big">' + esc(d.name) + '</span>' +
      '<div><b>' + esc(d.symptom) + '</b><p>' + esc(d.why) + '</p>' +
      '<ul class="dot">' + d.fix.map(f => '<li>' + esc(f) + '</li>').join('') + '</ul></div></div>').join('') +
    '</div>' +
  '</div>';
}

/* --- 真实封面墙（有 refs.js 时用） --- */
function fmtNum(n){
  if (!n) return '0';
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + 'w';
  return String(n);
}
function renderWall(){
  const r = REFS;
  const items = (r.items || []).slice();
  if (!items.length) return '';
  const total = r.count || items.length;
  const shown = WALL_SHOW;
  const folded = total > shown;
  const list = folded ? items.slice(0, shown) : items;
  const note = r.dropped_low_rel
    ? '（已剔掉 ' + r.dropped_low_rel + ' 条相关度太低的，宁可少给也不给你跑题的图）' : '';
  /* 内嵌版（手机单文件）用 cover_embed（data URI），离线也能看；在线版用 cover URL。 */
  const embedded = !!r.embedded;
  const srcOf = it => it.cover_embed || it.cover;

  return '<div class="card wall-card">' +
    '<div class="wall-head">' +
      '<div><h3>真实爆款封面墙 <small>' + total + ' 张 · 来自小红书实时搜索</small></h3>' +
      '<p class="hint">检索词「<b>' + esc(r.query_used || '') + '</b>」 · 抓取于 ' + esc(r.generated_at || '') + note +
      (embedded ? ' · <b>图片已内嵌，拔网线也能看</b>' : '') + '</p></div>' +
      (embedded ? '' : '<button type="button" class="btn ghost sm" id="refreshRefs">↻ 换一批</button>') +
    '</div>' +
    '<p class="hint">按点赞量排序。点封面看大图，点标题跳到原笔记 —— 原笔记里还能看到作者发的其他角度。</p>' +
    '<div class="wall">' + list.map((it, i) =>
      '<figure class="wall-item" data-i="' + i + '">' +
        '<div class="wall-img" data-zoom="' + esc(srcOf(it)) + '" title="点击看大图">' +
          '<img src="' + esc(srcOf(it)) + '" alt="' + esc(it.title) + '"' +
          (embedded ? '' : ' loading="lazy" referrerpolicy="no-referrer"') + '>' +
        '</div>' +
        '<figcaption>' +
          '<a class="wall-title" href="' + esc(it.url) + '" target="_blank" rel="noopener">' + esc(it.title || '无标题') + '</a>' +
          '<span class="wall-meta">♥ ' + fmtNum(it.likes) + '　☆ ' + fmtNum(it.collects) + '</span>' +
        '</figcaption>' +
      '</figure>').join('') +
    '</div>' +
    (folded ? '<div class="wall-more"><button type="button" class="btn ghost" id="wallMore">展开剩下 ' +
      (total - shown) + ' 张</button></div>' : '') +
    '<p class="hint">这些图是「参考」不是「模板」：看它们的<b>光从哪来、主体在哪、留白多少</b>，' +
    '然后用「机位与构图」页的网格去复现，而不是抄同一个摆设。</p>' +
  '</div>';
}

/* --- 参考图（真实封面墙 + 平台深链） --- */
function renderRefs(p){
  const qs = p.keywords;
  return (REFS ? renderWall() : '') +
  '<div class="card note">' + (REFS
    ? '上面的封面墙是脚本抓下来的「某一刻」的爆款；下面的入口是「永远新鲜」的搜索页，' +
      '想追最新趋势就点这里，看到好的截图存进「我的参考墙」。'
    : '点下面的词会直接打开对应平台的搜索页 —— 你看到的是此刻真实的爆款，' +
      '不是存下来的旧图。看到喜欢的就截图存进「我的参考墙」，用软件里的构图网格去反推它是怎么摆的。') +
  '<br><small>想在这里直接看到封面图？用取图脚本抓一次即可（见目录里的「怎么用.md」）。</small></div>' +
  qs.map(q => {
    const en = /^[a-zA-Z]/.test(q);
    const use = PLATFORMS.filter(pl => en ? pl.lang !== 'cn' : pl.lang !== 'en');
    return '<div class="card q">' +
      '<div class="qhead"><b>' + esc(q) + '</b>' + (en ? '<span class="badge">英文词 · 给 Pinterest/IG 用</span>' : '<span class="badge">中文词 · 给小红书/抖音用</span>') + '</div>' +
      '<div class="plats">' + use.map(pl =>
        '<a class="plat" href="' + encodeURI(pl.url(q)) + '" target="_blank" rel="noopener">' +
        '<b>' + esc(pl.name) + '</b><small>' + esc(pl.tag) + '</small></a>').join('') + '</div>' +
    '</div>';
  }).join('') +
  '<div class="card"><h3>每个平台该怎么看</h3><ul class="dot">' +
    PLATFORMS.map(pl => '<li><b>' + esc(pl.name) + '</b>：' + esc(pl.how) + '</li>').join('') +
  '</ul><h3>怎么用「拆解」而不是「抄袭」</h3><ul class="dot">' +
    ['只看三件事：光从哪来、主体在画面哪个位置、留白留了多少',
     '找到 3 张你觉得好看的图，把它们都套上三分线，你会发现主体几乎都落在交叉点附近',
     '把喜欢的那张图的颜色提取出来（手机相册自带的取色器），和你的照片对比，缺什么补什么',
     '收藏 10 张就够建审美：这 10 张就是你的风格基线，以后照着这个方向拍'].map(x => '<li>' + esc(x) + '</li>').join('') +
  '</ul></div>';
}

/* --- 发布 --- */
function renderPost(p){
  return '<div class="card"><h3>可以直接用的标题（三选一改改就行）</h3>' +
    '<ul class="title-list">' + p.titles.map(t => '<li><button class="copy" data-copy="' + esc(t) + '">复制</button><span>' + esc(t) + '</span></li>').join('') + '</ul>' +
    '</div>' +
  '<div class="card"><h3>标签（8–10 个最佳）</h3>' +
    '<div class="chips">' + p.tags.map(t => '<span class="chip tag">' + esc(t) + '</span>').join('') + '</div>' +
    '<p class="hint">大词 2 个（蹭流量）+ 精准词 4 个（找对人）+ 风格词 2 个（定审美）+ 互动词 1 个。</p></div>' +
  '<div class="card"><h3>发布检查清单</h3><ul class="dot">' + SHARE_CHECK.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' +
  '<div class="card"><h3>设备技巧 · 你现在用的是 ' + (p.device === 'phone' ? '手机' : '相机') + '</h3>' +
    '<ul class="dot">' + p.devTips.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
}

/* --- 顶部概览 --- */
function renderHead(p){
  return '<div class="hero-result">' +
    '<div class="hr-left">' +
      '<div class="hr-eyebrow">你的拍摄方案</div>' +
      '<h2>在「' + esc(p.env.name) + '」，用「' + esc(p.light.name) + '」，拍「' + esc(p.subj.name) + '」</h2>' +
      '<p class="hr-sub">风格：<b>' + esc(p.style.name) + '</b> · ' + esc(p.style.tone) + ' · ' + esc(p.device === 'phone' ? '手机' : '相机') + '</p>' +
      '<div class="hr-meta">' +
        '<span>机位 ' + p.shots.length + ' 套</span><span>调色参数 ' + Object.keys(p.basic).length + ' 项</span>' +
        '<span>参考词 ' + p.keywords.length + ' 组</span>' +
      '</div>' +
    '</div>' +
    '<div class="hr-right">' + paletteBar('', p.style.palette, 34) +
      '<small>这套风格的用色</small></div>' +
  '</div>' +
  '<div class="card light-card">' +
    '<div class="lc-head"><b>当前光线：' + esc(p.light.name) + '</b><span>' + esc(p.light.sub) + '</span></div>' +
    '<p><b class="up-t">优势</b>' + esc(p.light.good) + '</p>' +
    '<p><b class="dn-t">风险</b>' + esc(p.light.risk) + '</p>' +
    '<ul class="dot">' + p.light.how.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
    '<p class="hint">' + esc(p.light.note) + '（已自动计入下方调色数值）</p>' +
  '</div>' +
  '<div class="card env-card">' +
    '<div class="lc-head"><b>场地：' + esc(p.env.name) + '</b><span>背景处理是成败关键</span></div>' +
    '<p class="hint">' + esc(p.env.background) + '</p>' +
    '<ul class="dot">' + p.env.tip.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
  '</div>';
}

/* --- 总渲染 --- */
function render(){
  const p = PLAN || generate();
  $('#head').innerHTML = renderHead(p);
  $('#place').innerHTML = renderPlace(p);
  $('#shots').innerHTML = '<div class="card note">同一组东西，至少拍 3 个机位。下面每一张都给了俯视构图（东西摆哪）和机位侧视（人站哪、手机举多高）。</div>'
    + p.shots.map(shotCard).join('');
  $('#color').innerHTML = renderColor(p);
  $('#logic').innerHTML = renderLogic(p);
  $('#refs').innerHTML = renderRefs(p);
  $('#post').innerHTML = renderPost(p);
}

/* ---------- 表单 ---------- */
function buildForm(){
  // 快速主体
  $('#quickSubj').innerHTML = ['咖啡','早餐','书桌','花','甜品','穿搭','宠物','街景','夜景','家常菜','咖啡馆探店','好物']
    .map(s => '<button type="button" class="qbtn" data-subj="' + s + '">' + s + '</button>').join('');
  // 场地
  $('#envList').innerHTML = ENVS.map(e =>
    '<button type="button" class="opt" data-env="' + e.id + '"><b>' + esc(e.name) + '</b></button>').join('');
  // 光线
  $('#lightList').innerHTML = LIGHTS.map(l =>
    '<button type="button" class="opt" data-light="' + l.id + '"><b>' + esc(l.name) + '</b><small>' + esc(l.sub) + '</small></button>').join('');
  // 风格
  $('#styleList').innerHTML = STYLES.map(s =>
    '<button type="button" class="style-card" data-style="' + s.id + '">' +
      paletteBar('mini', s.palette, 14) +
      '<b>' + esc(s.name) + '</b><small>' + esc(s.tone) + '</small>' +
    '</button>').join('');
  // 道具
  $('#propList').innerHTML = PROPS.map(p =>
    '<button type="button" class="opt sm" data-prop="' + p.id + '">' + esc(p.name) + '</button>').join('');
}

function syncForm(){
  $('#subjectText').value = ST.subjectText;
  $$('#envList .opt').forEach(b => b.classList.toggle('on', b.dataset.env === ST.env));
  $$('#lightList .opt').forEach(b => b.classList.toggle('on', b.dataset.light === ST.light));
  $$('#styleList .style-card').forEach(b => b.classList.toggle('on', b.dataset.style === ST.style));
  $$('#propList .opt').forEach(b => b.classList.toggle('on', ST.props.indexOf(b.dataset.prop) >= 0));
  $$('#deviceList .opt').forEach(b => b.classList.toggle('on', b.dataset.device === ST.device));
  $$('#quickSubj .qbtn').forEach(b => b.classList.toggle('on', b.dataset.subj === ST.subjectText));
}

function saveLast(){ try { localStorage.setItem(LS_LAST, JSON.stringify(ST)); } catch(e){} }
function loadLast(){ try { const v = JSON.parse(localStorage.getItem(LS_LAST) || 'null'); if (v && v.subjectText) ST = v; } catch(e){} }

/* ---------- 收藏 ---------- */
function favs(){ try { return JSON.parse(localStorage.getItem(LS_FAVS) || '[]'); } catch(e){ return []; } }
function setFavs(v){ try { localStorage.setItem(LS_FAVS, JSON.stringify(v)); } catch(e){} drawFavs(); }
function drawFavs(){
  const list = favs();
  $('#favWrap').style.display = list.length ? 'block' : 'none';
  $('#favList').innerHTML = list.map((f, i) =>
    '<li><div><b>' + esc(f.title) + '</b><small>' + esc(f.style) + ' · ' + esc(f.time) + '</small></div>' +
    '<div class="fav-act"><button data-load="' + i + '">打开</button><button data-del="' + i + '">删</button></div></li>').join('');
}
function savePlan(){
  const p = PLAN || generate();
  const list = favs();
  list.unshift({
    title: p.subj.name + ' · ' + p.env.name.split(/[\s/]+/)[0],
    style: p.style.name, time: new Date().toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }),
    st: JSON.parse(JSON.stringify(ST))
  });
  setFavs(list.slice(0, 50));
  toast('已存到「我的方案」');
}

/* ---------- 导出 Markdown ---------- */
function toMarkdown(){
  const p = PLAN || generate();
  const L = [];
  L.push('# 拍照方案 · ' + p.subj.name);
  L.push('');
  L.push('- 场地：' + p.env.name);
  L.push('- 光线：' + p.light.name + '（' + p.light.sub + '）');
  L.push('- 风格：' + p.style.name + '　' + p.style.tone);
  L.push('- 设备：' + (p.device === 'phone' ? '手机' : '相机'));
  L.push('');
  L.push('## 一、摆放方法');
  p.subj.place.forEach((x, i) => L.push((i + 1) + '. ' + x));
  L.push('');
  L.push('### 主体怎么处理');
  p.subj.photo.forEach(x => L.push('- ' + x));
  L.push('');
  L.push('### 道具');
  L.push(p.subj.props.join('、'));
  L.push('');
  L.push('### 别放这些东西');
  p.subj.avoid.forEach(x => L.push('- ' + x));
  L.push('');
  L.push('## 二、机位');
  p.shots.forEach((s, i) => {
    L.push('');
    L.push('### ' + (i + 1) + '. ' + s.name);
    L.push('- 角度：' + s.angle);
    L.push('- 焦距：' + s.focal);
    L.push('- 距离：' + s.dist);
    L.push('- 主体占比：' + s.share);
    L.push('- 用光：' + s.light);
    L.push('- 摆放：');
    s.layout.items.forEach(it => L.push('  - ' + it.label + '（' + it.kind + '，位置 x' + it.x.toFixed(2) + ' y' + it.y.toFixed(2) + '）'));
    s.tips.forEach(t => L.push('- ' + t));
  });
  L.push('');
  L.push('## 三、调色（Lightroom 手机版）');
  L.push('');
  L.push('| 参数 | 数值 |');
  L.push('| --- | --- |');
  Object.keys(p.basic).forEach(k => L.push('| ' + k + ' | ' + fmt(k, p.basic[k]) + ' |'));
  L.push('');
  L.push('### 颜色分级');
  L.push('- 高光：色相 ' + p.style.grade.split.high.h + ' / 饱和度 ' + p.style.grade.split.high.s);
  L.push('- 阴影：色相 ' + p.style.grade.split.shadow.h + ' / 饱和度 ' + p.style.grade.split.shadow.s);
  L.push('');
  L.push('### 混色 HSL（色相/饱和/明度）');
  L.push('');
  L.push('| 颜色 | 色相 | 饱和 | 明度 |');
  L.push('| --- | --- | --- | --- |');
  p.style.grade.hsl.forEach(h => L.push('| ' + h.ch + ' | ' + fmt('', h.h) + ' | ' + fmt('', h.s) + ' | ' + fmt('', h.l) + ' |'));
  L.push('');
  L.push('### 曲线与效果');
  L.push('- ' + p.style.grade.curve.note);
  Object.keys(p.style.grade.effects).forEach(k => L.push('- ' + k + '：' + fmt('', p.style.grade.effects[k])));
  L.push('');
  L.push('## 四、爆款逻辑');
  L.push('');
  L.push(p.style.why);
  L.push('');
  L.push('构图习惯：');
  p.style.compo.forEach(x => L.push('- ' + x));
  L.push('');
  L.push('翻车点：');
  p.style.pitfalls.forEach(x => L.push('- ' + x));
  L.push('');
  L.push('## 五、搜索参考图');
  p.keywords.forEach(q => {
    L.push('- ' + q);
    PLATFORMS.forEach(pl => L.push('  - ' + pl.name + '：' + pl.url(q)));
  });
  L.push('');
  L.push('## 六、标题与标签');
  p.titles.forEach(t => L.push('- ' + t));
  L.push('');
  L.push(p.tags.join(' '));
  L.push('');
  return L.join('\n');
}

/* ---------- 小工具 ---------- */
function activateTab(id){
  const b = document.querySelector('.tab[data-pane="' + id + '"]');
  if (!b) return;
  $$('.tab').forEach(t => t.classList.toggle('on', t === b));
  $$('.pane').forEach(p => p.classList.toggle('on', p.id === id));
  TAB = id;
}
let toastTimer = null;
function toast(msg){
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}
function copyText(txt, label){
  const done = () => toast(label || '已复制');
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(done).catch(() => fallbackCopy(txt, done));
  } else fallbackCopy(txt, done);
}
function fallbackCopy(txt, done){
  const ta = document.createElement('textarea');
  ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch(e){ toast('复制失败，请手动选中'); }
  document.body.removeChild(ta);
}
function download(name, txt){
  const blob = new Blob([txt], { type:'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* 封面图灯箱：点缩略图看大图，方便在图上套三分线看构图 */
function openLightbox(src){
  const lb = $('#lightbox');
  $('#lightboxImg').src = src;
  lb.classList.add('on');
  document.body.style.overflow = 'hidden';
}
function closeLightbox(){
  const lb = $('#lightbox');
  if (!lb.classList.contains('on')) return;
  lb.classList.remove('on');
  $('#lightboxImg').src = '';
  document.body.style.overflow = '';
}

/* ---------- 事件 ---------- */
function bind(){
  $('#quickSubj').addEventListener('click', e => {
    const b = e.target.closest('.qbtn'); if (!b) return;
    ST.subjectText = b.dataset.subj; syncForm();
  });
  $('#subjectText').addEventListener('input', e => { ST.subjectText = e.target.value; });
  $('#envList').addEventListener('click', e => { const b = e.target.closest('.opt'); if (!b) return; ST.env = b.dataset.env; syncForm(); });
  $('#lightList').addEventListener('click', e => { const b = e.target.closest('.opt'); if (!b) return; ST.light = b.dataset.light; syncForm(); });
  $('#styleList').addEventListener('click', e => { const b = e.target.closest('.style-card'); if (!b) return; ST.style = b.dataset.style; syncForm(); });
  $('#deviceList').addEventListener('click', e => { const b = e.target.closest('.opt'); if (!b) return; ST.device = b.dataset.device; syncForm(); });
  $('#propList').addEventListener('click', e => {
    const b = e.target.closest('.opt'); if (!b) return;
    const id = b.dataset.prop, i = ST.props.indexOf(id);
    if (i >= 0) ST.props.splice(i, 1); else ST.props.push(id);
    syncForm();
  });

  $$('.js-go').forEach(b => b.addEventListener('click', () => {
    if (!ST.subjectText.trim()) ST.subjectText = '今天随手拍';
    generate(); saveLast(); render(); syncForm();
    $('#result').scrollIntoView({ behavior:'smooth', block:'start' });
    toast('方案已生成');
  }));
  $$('.js-random').forEach(b => b.addEventListener('click', () => {
    ST.subjectText = rnd(SUBJECTS).name;
    ST.env = rnd(ENVS).id; ST.light = rnd(LIGHTS).id; ST.style = rnd(STYLES).id;
    ST.props = PROPS.filter(() => Math.random() < .25).map(p => p.id).slice(0, 3);
    generate(); saveLast(); render(); syncForm();
    $('#result').scrollIntoView({ behavior:'smooth', block:'start' });
    toast('换了一套新思路');
  }));

  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('.tab'); if (!b) return;
    $$('.tab').forEach(t => t.classList.toggle('on', t === b));
    $$('.pane').forEach(p => p.classList.toggle('on', p.id === b.dataset.pane));
    TAB = b.dataset.pane;
  });

  $('#saveBtn').addEventListener('click', savePlan);
  $('#mdBtn').addEventListener('click', () => { download('拍照方案-' + (PLAN ? PLAN.subj.name : '方案') + '.md', toMarkdown()); toast('已导出 Markdown'); });
  $('#copyAll').addEventListener('click', () => {
    const pane = $('.pane.on');
    copyText(pane ? pane.innerText : '', '已复制「' + (pane ? pane.innerText.split('\n')[0].slice(0, 12) : '') + '…」这一页');
  });

  $('#favList').addEventListener('click', e => {
    const l = e.target.closest('[data-load]'), d = e.target.closest('[data-del]');
    const list = favs();
    if (l){ ST = JSON.parse(JSON.stringify(list[+l.dataset.load].st)); syncForm(); generate(); saveLast(); render(); toast('已载入方案'); }
    if (d){ list.splice(+d.dataset.del, 1); setFavs(list); }
  });

  document.addEventListener('click', e => {
    const c = e.target.closest('[data-copy]');
    if (c) copyText(c.dataset.copy, '已复制');
  });

  /* --- 封面墙交互（用事件委托，渲染后不用重新绑定） --- */
  $('#refs').addEventListener('click', e => {
    const zoom = e.target.closest('[data-zoom]');
    if (zoom){ openLightbox(zoom.dataset.zoom); return; }
    if (e.target.closest('#wallMore')){ WALL_SHOW += 24; render(); return; }
    if (e.target.closest('#refreshRefs')){
      toast('在终端里跑一次 fetch_refs.py 就能换一批（见「怎么用.md」）');
    }
  });

  /* --- 灯箱 --- */
  $('#lightbox').addEventListener('click', closeLightbox);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLightbox();
  });
}

/* ---------- 启动 ---------- */
buildForm();
loadLast();
syncForm();
bind();
generate();
render();
drawFavs();
if (location.hash.length > 1) activateTab(location.hash.slice(1));
