// ============================================================
// script.js — ระบบเช็คชื่อนักเรียน (Enhanced + Fixed)
// ============================================================

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyhr5RgpoGNSCSjPFI8FG1ACoVwrK63NK8JvugdcrnfusKb7SsMVLzPTMOD39f-x9fZ/exec';

// ===== STATE =====
const state = {
    students: [],
    attendance: {}, // { "YYYY-MM-DD": [ {student_id, status, name, class, number} ] }
    loaded: false,
    chart: null,
    saving: false,
};

// ===== INIT =====
window.addEventListener('load', () => {
    setTodayDate();
    startClock();
    loadAllData(false);

});

function setTodayDate() {
    const t = new Date();
    const s = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
    const el = document.getElementById('checkin-date');
    if (el) el.value = s;
}

function pad(n) { return String(n).padStart(2, '0'); }

function todayStr() {
    const t = new Date();
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

function startClock() {
    const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
    const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    function tick() {
        const n = new Date();
        setText('clock-day', 'วัน' + DAYS[n.getDay()]);
        setText('clock-date', `${n.getDate()} ${MONTHS[n.getMonth()]} ${n.getFullYear() + 543}`);
        setText('clock-time', `${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`);
    }
    tick(); setInterval(tick, 1000);
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// ===== NAVIGATION =====
function showPage(id, navEl) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const pg = document.getElementById('page-' + id);
    if (pg) pg.classList.add('active');
    if (navEl) navEl.classList.add('active');
    closeSidebar();
    if (id === 'students-list') renderStudentList();
    if (id === 'statistics') { renderStats(); renderChart(); }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('active');
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
}

// ===== JSONP =====
function gasRequest(params) {
    return new Promise((resolve, reject) => {
        const cbName = '_cb_' + Date.now() + '_' + Math.floor(Math.random() * 9999);
        const qs = Object.entries({ ...params, callback: cbName })
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
        const url = GAS_URL + '?' + qs;
        let done = false;

        window[cbName] = (data) => {
            done = true;
            delete window[cbName];
            if (s) document.head.removeChild(s);
            resolve(data);
        };

        const timer = setTimeout(() => {
            if (!done) { done = true; delete window[cbName]; if (s) try { document.head.removeChild(s); } catch (e) { } reject(new Error('timeout')); }
        }, 12000);

        const s = document.createElement('script');
        s.src = url;
        s.onerror = () => { if (!done) { clearTimeout(timer); done = true; delete window[cbName]; reject(new Error('network')); } };
        document.head.appendChild(s);
    });
}

// ===== LOAD ALL DATA =====
async function loadAllData(showFeedback = false) {
    if (showFeedback) {
        const icon = document.getElementById('refreshIcon');
        if (icon) icon.style.animation = 'spin .7s linear infinite';
    }
    try {
        const res = await gasRequest({ action: 'getData' });
        if (res && res.success) {
            state.students = res.students || [];
            state.attendance = res.attendance || {};
            state.loaded = true;
            updateBadge();
            updateDashboard();
            if (document.getElementById('page-students-list')?.classList.contains('active')) renderStudentList();
            if (document.getElementById('page-statistics')?.classList.contains('active')) { renderStats(); renderChart(); }
            if (showFeedback) toast('โหลดข้อมูลเรียบร้อย', 's');
        }
    } catch (e) {
        if (showFeedback) toast('ไม่สามารถโหลดข้อมูลได้', 'e');
    } finally {
        const icon = document.getElementById('refreshIcon');
        if (icon) icon.style.animation = '';
    }
}

// ===== BADGE & DASHBOARD =====
function updateBadge() {
    setText('dash-total', state.students.length);
}

function setStatAnimated(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    const old = el.textContent;
    el.textContent = val;
    if (old !== String(val)) {
        el.classList.remove('counting');
        void el.offsetWidth; // reflow
        el.classList.add('counting');
        // shimmer parent card
        const card = el.closest('.stat-card');
        if (card) {
            card.classList.remove('flash');
            void card.offsetWidth;
            card.classList.add('flash');
            setTimeout(() => card.classList.remove('flash'), 500);
        }
    }
}

function updateDashboard() {
    const today = todayStr();
    const dayRecs = state.attendance[today] || [];
    const seen = {};
    dayRecs.forEach(r => { seen[r.student_id] = r.status; });
    let p = 0, l = 0, lv = 0, a = 0;
    Object.values(seen).forEach(s => { if (s === 'present') p++; else if (s === 'late') l++; else if (s === 'leave') lv++; else if (s === 'absent') a++; });
    setStatAnimated('dash-present', p || '—');
    setStatAnimated('dash-late', l || '—');
    setStatAnimated('dash-leave', lv || '—');
    setStatAnimated('dash-absent', a || '—');
    const days = Object.keys(state.attendance).length;
    setText('dash-days', days > 0 ? days + ' วัน' : '—');
    const total = p + l + lv + a;
    setText('dash-rate', total > 0 ? Math.round(p / total * 100) + '%' : '—');
}

// ===== CHECK-IN PAGE =====
let ciStatus = {};

function loadCheckin() {
    const cls = document.getElementById('checkin-class').value;
    const date = document.getElementById('checkin-date').value;
    const wrap = document.getElementById('checkin-wrap');
    const saveSection = document.getElementById('save-section');
    if (!cls) {
        wrap.innerHTML = '<div class="empty-state"><i class="fas fa-arrow-up"></i><p>กรุณาเลือกชั้นเรียนก่อน</p></div>';
        saveSection.style.display = 'none';
        return;
    }
    const students = state.students.filter(s => s.class === cls).sort((a, b) => (a.number || 0) - (b.number || 0));
    if (students.length === 0) {
        wrap.innerHTML = '<div class="empty-state"><i class="fas fa-user-slash"></i><p>ไม่มีนักเรียนในชั้นนี้</p></div>';
        saveSection.style.display = 'none';
        return;
    }
    ciStatus = {};
    const dayRecs = state.attendance[date] || [];
    dayRecs.forEach(r => { if (students.find(s => s.id === r.student_id)) ciStatus[r.student_id] = r.status; });

    renderCheckinTable(students, date);
    saveSection.style.display = 'block';
}

function renderCheckinTable(students, date) {
    const wrap = document.getElementById('checkin-wrap');
    let html = '';
    students.forEach(s => {
        const cur = ciStatus[s.id] || null;
        html += `
        <div class="ci-card" id="cir-${s.id}">
          <div class="ci-info">
            <div class="ci-num">${s.number || '—'}</div>
            <div class="ci-name">${s.name}</div>
          </div>
          <div class="ci-btns">
            <button class="ci-btn ci-p${cur === 'present' ? ' on' : ''}" onclick="ciSet('${s.id}','present')">
              <i class="fas fa-check"></i><span>มา</span>
            </button>
            <button class="ci-btn ci-l${cur === 'late' ? ' on' : ''}" onclick="ciSet('${s.id}','late')">
              <i class="fas fa-clock"></i><span>สาย</span>
            </button>
            <button class="ci-btn ci-lv${cur === 'leave' ? ' on' : ''}" onclick="ciSet('${s.id}','leave')">
              <i class="fas fa-file-alt"></i><span>ลา</span>
            </button>
            <button class="ci-btn ci-a${cur === 'absent' ? ' on' : ''}" onclick="ciSet('${s.id}','absent')">
              <i class="fas fa-times"></i><span>ขาด</span>
            </button>
          </div>
        </div>`;
    });
    wrap.innerHTML = html;
}

function ciSet(sid, st, event) {
    ciStatus[sid] = st;
    const card = document.getElementById('cir-' + sid);
    if (!card) return;
    card.querySelectorAll('.ci-btn').forEach(btn => btn.classList.remove('on'));
    const map = { present: 'ci-p', late: 'ci-l', leave: 'ci-lv', absent: 'ci-a' };
    const btn = card.querySelector('.' + map[st]);
    if (btn) {
        btn.classList.add('on');
        // Ripple
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        const rect = btn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 2;
        ripple.style.cssText = `width:${size}px;height:${size}px;left:${(rect.width-size)/2}px;top:${(rect.height-size)/2}px`;
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    }
}

function setAllPresent() {
    const cls = document.getElementById('checkin-class').value;
    if (!cls) return;
    const students = state.students.filter(s => s.class === cls);
    students.forEach(s => ciSet(s.id, 'present'));
}

async function saveCheckin() {
    if (state.saving) return;
    const date = document.getElementById('checkin-date').value;
    const cls = document.getElementById('checkin-class').value;
    if (!date || !cls) return toast('กรุณาเลือกวันที่และชั้นเรียน', 'e');

    const students = state.students.filter(s => s.class === cls);
    const records = students.map(s => ({
        student_id: s.id,
        status: ciStatus[s.id] || 'present',
        name: s.name,
        class: s.class,
        number: s.number,
    }));

    if (records.length === 0) return toast('ไม่มีข้อมูลนักเรียน', 'e');

    Swal.fire({
        title: 'กำลังบันทึก...',
        html: `<div class="loading-wrap">
              <div class="loading-ring"></div>
              <p class="loading-text">กรุณารอสักครู่</p>
            </div>`,
        allowOutsideClick: false,
        showConfirmButton: false,
        customClass: { popup: 'custom-swal-popup', title: 'custom-swal-title' }
    });

    state.saving = true;
    try {
        const res = await gasRequest({ action: 'saveAttendance', date, class: cls, records: JSON.stringify(records) });
        if (res && res.success) {
            if (!state.attendance[date]) state.attendance[date] = [];
            state.attendance[date] = state.attendance[date].filter(r => {
                const st = state.students.find(s => s.id === r.student_id);
                return st && st.class !== cls;
            });
            records.forEach(r => state.attendance[date].push({ student_id: r.student_id, status: r.status }));
            updateDashboard();
            Swal.fire({
                icon: 'success',
                title: 'บันทึกสำเร็จ!',
                html: `<b>เช็คชื่อ ${cls}</b><br>วันที่ ${date}<br>${records.length} คน`,
                timer: 2500,
                showConfirmButton: false,
                customClass: { popup: 'custom-swal-popup', title: 'custom-swal-title', htmlContainer: 'custom-swal-html' }
            });
        } else {
            throw new Error(res?.message || 'Unknown error');
        }
    } catch (e) {
        Swal.fire({
            icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถบันทึกได้ กรุณาลองใหม่',
            confirmButtonText: 'ตกลง',
            customClass: { popup: 'custom-swal-popup', title: 'custom-swal-title', htmlContainer: 'custom-swal-html', confirmButton: 'custom-swal-confirm' }
        });
    } finally {
        state.saving = false;
    }
}

// ===== ADD STUDENT — FIXED =====
async function addStudent() {
    // อ่านค่าจาก input
    const numEl   = document.getElementById('add-num');
    const nameEl  = document.getElementById('add-name');
    const clsEl   = document.getElementById('add-class');
    const roomEl  = document.getElementById('add-room');

    const num  = numEl  ? numEl.value.trim()  : '';
    const name = nameEl ? nameEl.value.trim() : '';
    const cls  = clsEl  ? clsEl.value.trim()  : '';
    const room = roomEl ? roomEl.value.trim()  : '';

    // Validate
    if (!num || !name || !cls) {
        return toast('กรุณากรอกข้อมูลให้ครบ (เลขที่ / ชื่อ / ชั้น)', 'e');
    }

    // เช็คซ้ำ
    const dup = state.students.find(s =>
        s.class === cls &&
        String(s.number) === String(num) &&
        (s.room || '') === room
    );
    if (dup) return toast(`เลขที่ ${num} ชั้น ${cls}${room ? ' ' + room : ''} มีอยู่แล้ว`, 'e');

    Swal.fire({
        title: 'กำลังเพิ่ม...',
        html: `<div class="loading-wrap">
              <div class="loading-ring"></div>
              <p class="loading-text">กรุณารอสักครู่</p>
            </div>`,
        allowOutsideClick: false,
        showConfirmButton: false,
        customClass: { popup: 'custom-swal-popup', title: 'custom-swal-title' }
    });

    const sid = 's' + Date.now();
    const student = { id: sid, number: parseInt(num), name, class: cls, room };
    try {
        const res = await gasRequest({ action: 'addStudent', student: JSON.stringify(student) });
        if (res && res.success) {
            state.students.push(student);
            updateBadge();
            // เคลียร์ฟอร์ม
            if (numEl)  numEl.value  = '';
            if (nameEl) nameEl.value = '';
            if (clsEl)  clsEl.value  = '';
            if (roomEl) roomEl.value = '';
            Swal.fire({
                icon: 'success',
                title: 'เพิ่มนักเรียนเรียบร้อย!',
                html: `<b>${name}</b><br>ชั้น ${cls}${room ? ' ห้อง ' + room : ''} เลขที่ ${num}`,
                timer: 2500,
                showConfirmButton: false,
                customClass: { popup: 'custom-swal-popup', title: 'custom-swal-title', htmlContainer: 'custom-swal-html' }
            });
        } else {
            throw new Error(res?.message || 'Failed');
        }
    } catch (e) {
        Swal.fire({
            icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถเพิ่มนักเรียนได้',
            confirmButtonText: 'ตกลง',
            customClass: { popup: 'custom-swal-popup', title: 'custom-swal-title', htmlContainer: 'custom-swal-html', confirmButton: 'custom-swal-confirm' }
        });
    }
}

// ===== CUSTOM NUMBER SPINNER =====
function spinNum(dir) {
    const el = document.getElementById('add-num');
    if (!el) return;
    const val = parseInt(el.value) || 0;
    el.value = Math.min(99, Math.max(1, val + dir));
}

// ===== STUDENT LIST =====
function renderStudentList() {
    const wrap = document.getElementById('student-list-wrap');
    if (!wrap) return;
    const filter = document.getElementById('list-filter')?.value || '';
    let students = filter ? state.students.filter(s => s.class === filter) : state.students;
    students = [...students].sort((a, b) => {
        if (a.class < b.class) return -1;
        if (a.class > b.class) return 1;
        return (a.number || 0) - (b.number || 0);
    });
    if (students.length === 0) {
        wrap.innerHTML = '<div class="empty-state"><i class="fas fa-user-slash"></i><p>ไม่มีนักเรียน</p></div>';
        return;
    }

    const today = todayStr();
    const dayRecs = state.attendance[today] || [];

    let html = '';
    students.forEach(s => {
        const rec = [...dayRecs].reverse().find(r => r.student_id === s.id);
        const st = rec ? rec.status : null;
        let statusHTML = '';
        if (st === 'present') statusHTML = '<span class="sl-st p"><i class="fas fa-check"></i> มาเรียน</span>';
        else if (st === 'late') statusHTML = '<span class="sl-st l"><i class="fas fa-clock"></i> มาสาย</span>';
        else if (st === 'leave') statusHTML = '<span class="sl-st lv"><i class="fas fa-file-alt"></i> ลา</span>';
        else if (st === 'absent') statusHTML = '<span class="sl-st a"><i class="fas fa-times"></i> ขาด</span>';
        else statusHTML = '<span class="sl-st none">ยังไม่เช็คชื่อ</span>';

        html += `<div class="sl-card" id="slc-${s.id}">
      <div class="sl-top">
        <div class="sl-num">${s.number || '—'}</div>
        <div class="sl-info">
          <div class="sl-name">${s.name}</div>
          <div class="sl-sub">ชั้น ${s.class}${s.room ? ' · ห้อง ' + s.room : ''}</div>
        </div>
      </div>
      <div class="sl-bottom">
        ${statusHTML}
        <div class="sl-actions">
          <button class="sl-btn blue" onclick="changeAttendance('${s.id}')"><i class="fas fa-edit"></i> เปลี่ยน</button>
          <button class="sl-btn red" onclick="deleteStudentConfirm('${s.id}')"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    </div>`;
    });
    wrap.innerHTML = html;
}

async function deleteStudentConfirm(id) {
    const s = state.students.find(x => x.id === id);
    if (!s) return;
    const result = await Swal.fire({
        title: 'ยืนยันการลบ?',
        html: `ลบ <b>${s.name}</b><br><small>ชั้น ${s.class}${s.room ? ' ห้อง ' + s.room : ''} เลขที่ ${s.number}</small>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-trash"></i> ลบเลย',
        cancelButtonText: 'ยกเลิก',
        customClass: { popup: 'custom-swal-popup', title: 'custom-swal-title', htmlContainer: 'custom-swal-html', confirmButton: 'custom-swal-confirm', cancelButton: 'custom-swal-cancel' }
    });
    if (!result.isConfirmed) return;
    state.students = state.students.filter(s => s.id !== id);
    updateBadge();
    renderStudentList();
    toast('ลบนักเรียนเรียบร้อย', 's');
    gasRequest({ action: 'deleteStudent', id }).catch(() => { });
}

// ===== เปลี่ยนสถานะการเช็คชื่อ =====
async function changeAttendance(studentId) {
    const s = state.students.find(x => x.id === studentId);
    if (!s) return;

    const today = todayStr();
    const dayRecs = state.attendance[today] || [];
    const existingRec = [...dayRecs].reverse().find(r => r.student_id === studentId);
    const currentStatus = existingRec ? existingRec.status : null;

    const statusOptions = [
        { value: 'present', label: 'มาเรียน', icon: 'check', color: 'var(--green)' },
        { value: 'late',    label: 'มาสาย',   icon: 'clock', color: 'var(--yellow)' },
        { value: 'leave',   label: 'ลา',       icon: 'file-alt', color: 'var(--cyan)' },
        { value: 'absent',  label: 'ขาด',      icon: 'times',    color: 'var(--red)' },
    ];

    let optionsHTML = statusOptions.map(opt => {
        const checked = currentStatus === opt.value ? 'checked' : '';
        return `<label class="status-option">
      <input type="radio" name="newStatus" value="${opt.value}" ${checked}>
      <span style="color:${opt.color}"><i class="fas fa-${opt.icon}"></i> ${opt.label}</span>
    </label>`;
    }).join('');

    const result = await Swal.fire({
        title: 'เปลี่ยนสถานะ',
        html: `<div style="margin-bottom:12px;"><b>${s.name}</b><br><small>ชั้น ${s.class} · วันนี้ ${today}</small></div>
               <div class="status-options">${optionsHTML}</div>
               <div style="margin-top:16px;display:flex;gap:8px;justify-content:center;">
                 <button id="clearStatusBtn" class="custom-swal-cancel" style="padding:8px 16px;">ล้างข้อมูลวันนี้</button>
               </div>`,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-save"></i> บันทึก',
        cancelButtonText: 'ยกเลิก',
        customClass: { popup: 'custom-swal-popup', title: 'custom-swal-title', htmlContainer: 'custom-swal-html', confirmButton: 'custom-swal-confirm', cancelButton: 'custom-swal-cancel' },
        didOpen: () => {
            document.getElementById('clearStatusBtn')?.addEventListener('click', async () => {
                Swal.close();
                await clearStudentAttendance(studentId, today);
            });
        },
        preConfirm: () => {
            const selected = document.querySelector('input[name="newStatus"]:checked');
            if (!selected) { Swal.showValidationMessage('กรุณาเลือกสถานะ'); return false; }
            return selected.value;
        }
    });

    if (result.isConfirmed && result.value) {
        await saveStudentAttendance(studentId, today, result.value, s);
    }
}

async function saveStudentAttendance(studentId, date, status, student) {
    Swal.fire({ title: 'กำลังบันทึก...', html: `<div class="loading-wrap">
              <div class="loading-ring"></div>
              <p class="loading-text">กรุณารอสักครู่</p>
            </div>`, allowOutsideClick: false, showConfirmButton: false, customClass: { popup: 'custom-swal-popup', title: 'custom-swal-title' } });
    try {
        const rec = { student_id: studentId, status, name: student.name, class: student.class, number: student.number };
        const res = await gasRequest({ action: 'saveAttendance', date, studentId, records: JSON.stringify([rec]) });
        if (res && res.success) {
            if (!state.attendance[date]) state.attendance[date] = [];
            state.attendance[date] = state.attendance[date].filter(r => r.student_id !== studentId);
            state.attendance[date].push({ student_id: studentId, status });
            updateDashboard();
            renderStudentList();
            Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ!', html: `<b>${student.name}</b><br>สถานะ: ${status === 'present' ? 'มาเรียน' : status === 'late' ? 'มาสาย' : status === 'leave' ? 'ลา' : 'ขาด'}`, timer: 2000, showConfirmButton: false, customClass: { popup: 'custom-swal-popup', title: 'custom-swal-title', htmlContainer: 'custom-swal-html' } });
        } else throw new Error(res?.message || 'Failed');
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถบันทึกได้', confirmButtonText: 'ตกลง', customClass: { popup: 'custom-swal-popup', title: 'custom-swal-title', htmlContainer: 'custom-swal-html', confirmButton: 'custom-swal-confirm' } });
    }
}

async function clearStudentAttendance(studentId, date) {
    const s = state.students.find(x => x.id === studentId);
    if (!s) return;
    const result = await Swal.fire({
        title: 'ยืนยันการลบ?', html: `ลบข้อมูลการเช็คชื่อวันนี้<br>ของ <b>${s.name}</b>`, icon: 'warning',
        showCancelButton: true, confirmButtonText: '<i class="fas fa-trash"></i> ลบ', cancelButtonText: 'ยกเลิก',
        customClass: { popup: 'custom-swal-popup', title: 'custom-swal-title', htmlContainer: 'custom-swal-html', confirmButton: 'custom-swal-confirm', cancelButton: 'custom-swal-cancel' }
    });
    if (!result.isConfirmed) return;
    Swal.fire({ title: 'กำลังลบ...', html: `<div class="loading-wrap">
              <div class="loading-ring"></div>
              <p class="loading-text">กรุณารอสักครู่</p>
            </div>`, allowOutsideClick: false, showConfirmButton: false, customClass: { popup: 'custom-swal-popup', title: 'custom-swal-title' } });
    try {
        const res = await gasRequest({ action: 'deleteAttendance', studentId, date });
        if (res && res.success) {
            if (state.attendance[date]) {
                state.attendance[date] = state.attendance[date].filter(r => r.student_id !== studentId);
                if (state.attendance[date].length === 0) delete state.attendance[date];
            }
            updateDashboard();
            renderStudentList();
            Swal.fire({ icon: 'success', title: 'ลบสำเร็จ!', text: `ลบข้อมูลของ ${s.name} แล้ว`, timer: 2000, showConfirmButton: false, customClass: { popup: 'custom-swal-popup', title: 'custom-swal-title', htmlContainer: 'custom-swal-html' } });
        } else throw new Error(res?.message || 'Failed');
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถลบได้', confirmButtonText: 'ตกลง', customClass: { popup: 'custom-swal-popup', title: 'custom-swal-title', htmlContainer: 'custom-swal-html', confirmButton: 'custom-swal-confirm' } });
    }
}

// ===== ลบข้อมูลทั้งหมด =====
async function clearAllData() {
    const result = await Swal.fire({
        title: '',
        html: `
          <div class="del-popup">
            <!-- Icon + Title block -->
            <div class="del-header">
              <div class="del-icon-ring">
                <div class="del-icon-inner">
                  <i class="fas fa-trash-alt"></i>
                </div>
              </div>
              <h2 class="del-title">ลบข้อมูลทั้งหมด</h2>
              <p class="del-subtitle">การกระทำนี้<strong>ไม่สามารถย้อนกลับได้</strong></p>
            </div>

            <!-- What will be deleted -->
            <div class="del-items">
              <div class="del-item">
                <div class="del-item-icon"><i class="fas fa-users"></i></div>
                <span>ข้อมูลนักเรียนทั้งหมด</span>
              </div>
              <div class="del-item">
                <div class="del-item-icon"><i class="fas fa-clipboard-check"></i></div>
                <span>ข้อมูลการเช็คชื่อทั้งหมด</span>
              </div>
              <div class="del-item">
                <div class="del-item-icon"><i class="fas fa-database"></i></div>
                <span>ข้อมูลใน Google Sheets</span>
              </div>
            </div>

            <!-- Confirm input -->
            <div class="del-confirm-section">
              <p class="del-confirm-label">พิมพ์ <span class="del-keyword">"ลบทั้งหมด"</span> เพื่อยืนยัน</p>
              <input id="danger-confirm-input" class="del-input" type="text"
                     placeholder="ลบทั้งหมด" autocomplete="off">
              <div id="danger-input-error" class="del-error" style="display:none;">
                <i class="fas fa-times-circle"></i> กรุณาพิมพ์ให้ถูกต้อง
              </div>
            </div>
          </div>`,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-trash-alt"></i> ยืนยันการลบ',
        cancelButtonText: '<i class="fas fa-times"></i> ยกเลิก',
        customClass: {
            popup: 'custom-swal-popup del-mode',
            htmlContainer: 'del-html-container',
            confirmButton: 'custom-swal-confirm danger-confirm',
            cancelButton: 'custom-swal-cancel',
        },
        preConfirm: () => {
            const val = (document.getElementById('danger-confirm-input')?.value || '').trim();
            const errEl = document.getElementById('danger-input-error');
            if (val !== 'ลบทั้งหมด') {
                if (errEl) errEl.style.display = 'block';
                const inp = document.getElementById('danger-confirm-input');
                if (inp) { inp.classList.add('shake'); setTimeout(() => inp.classList.remove('shake'), 500); }
                return false;
            }
            return true;
        }
    });

    if (!result.isConfirmed) return;

    Swal.fire({ title: 'กำลังลบข้อมูล...', html: `<div class="loading-wrap">
              <div class="loading-ring"></div>
              <p class="loading-text">กรุณารอสักครู่</p>
            </div>`, allowOutsideClick: false, showConfirmButton: false, customClass: { popup: 'custom-swal-popup', title: 'custom-swal-title' } });

    try {
        const res = await gasRequest({ action: 'clearAllData' });
        if (res && res.success) {
            state.students = [];
            state.attendance = {};
            updateBadge();
            updateDashboard();
            renderStudentList();
            renderStats();
            if (state.chart) state.chart.destroy();
            Swal.fire({ icon: 'success', title: 'ลบข้อมูลสำเร็จ!', text: 'ข้อมูลทั้งหมดถูกลบแล้ว', timer: 2500, showConfirmButton: false, customClass: { popup: 'custom-swal-popup', title: 'custom-swal-title', htmlContainer: 'custom-swal-html' } });
        } else throw new Error(res?.message || 'Failed');
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถลบข้อมูลได้', confirmButtonText: 'ตกลง', customClass: { popup: 'custom-swal-popup', title: 'custom-swal-title', htmlContainer: 'custom-swal-html', confirmButton: 'custom-swal-confirm' } });
    }
}

// ===== STATISTICS =====
function renderStats() {
    let tp = 0, tl = 0, tlv = 0, ta = 0;
    Object.values(state.attendance).forEach(recs => {
        const seen = {};
        recs.forEach(r => { seen[r.student_id] = r.status; });
        Object.values(seen).forEach(s => { if (s === 'present') tp++; else if (s === 'late') tl++; else if (s === 'leave') tlv++; else if (s === 'absent') ta++; });
    });
    setText('st-present', tp); setText('st-late', tl); setText('st-leave', tlv); setText('st-absent', ta);

    const wrap = document.getElementById('stats-wrap');
    if (!wrap) return;
    const filter = document.getElementById('stat-filter')?.value || '';
    let students = filter ? state.students.filter(s => s.class === filter) : state.students;
    students = [...students].sort((a, b) => { if (a.class < b.class) return -1; if (a.class > b.class) return 1; return (a.number || 0) - (b.number || 0); });
    if (students.length === 0) {
        wrap.innerHTML = '<div class="empty-state"><i class="fas fa-chart-bar"></i><p>ยังไม่มีข้อมูล</p></div>';
        return;
    }
    let html = `<table class="st-tbl"><thead><tr>
    <th>เลขที่</th><th>ชื่อ</th><th>ชั้น</th>
    <th style="color:var(--green)">มา</th><th style="color:var(--yellow)">สาย</th>
    <th style="color:var(--cyan)">ลา</th><th style="color:var(--red)">ขาด</th>
    <th>%มา</th>
  </tr></thead><tbody>`;
    students.forEach(s => {
        let p = 0, l = 0, lv = 0, a = 0;
        Object.values(state.attendance).forEach(recs => {
            const rec = [...recs].reverse().find(r => r.student_id === s.id);
            if (!rec) return;
            if (rec.status === 'present') p++; else if (rec.status === 'late') l++; else if (rec.status === 'leave') lv++; else if (rec.status === 'absent') a++;
        });
        const total = p + l + lv + a;
        const rate = total > 0 ? Math.round(p / total * 100) : null;
        const rateColor = rate === null ? 'var(--muted)' : rate >= 80 ? 'var(--green)' : rate >= 60 ? 'var(--yellow)' : 'var(--red)';
        html += `<tr>
      <td>${s.number || '—'}</td>
      <td style="font-weight:500">${s.name}</td>
      <td><span style="background:rgba(59,130,246,.12);color:var(--blue);padding:2px 7px;border-radius:20px;font-size:10px;font-weight:700;">${s.class}</span></td>
      <td style="color:var(--green);font-weight:600">${p}</td>
      <td style="color:var(--yellow);font-weight:600">${l}</td>
      <td style="color:var(--cyan);font-weight:600">${lv}</td>
      <td style="color:var(--red);font-weight:600">${a}</td>
      <td style="font-weight:700;color:${rateColor}">${rate !== null ? rate + '%' : '—'}</td>
    </tr>`;
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
}

// ===== LINE CHART =====
function renderChart() {
    const canvas = document.getElementById('lineChart');
    if (!canvas) return;

    const CLASSES = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6']
        .filter(cls => state.students.some(s => s.class === cls));
    if (CLASSES.length === 0) return;

    const data = { present: {}, late: {}, leave: {}, absent: {} };
    CLASSES.forEach(cls => { ['present', 'late', 'leave', 'absent'].forEach(st => { data[st][cls] = 0; }); });

    CLASSES.forEach(cls => {
        const students = state.students.filter(s => s.class === cls);
        Object.values(state.attendance).forEach(recs => {
            students.forEach(s => {
                const rec = [...recs].reverse().find(r => r.student_id === s.id);
                if (!rec) return;
                data[rec.status][cls] = (data[rec.status][cls] || 0) + 1;
            });
        });
    });

    const datasets = [
        { label: 'มา',   data: CLASSES.map(c => data.present[c] || 0), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.08)', tension: .4, pointRadius: 4, pointHoverRadius: 6, borderWidth: 2.5 },
        { label: 'สาย',  data: CLASSES.map(c => data.late[c]    || 0), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,.08)', tension: .4, pointRadius: 4, pointHoverRadius: 6, borderWidth: 2.5 },
        { label: 'ลา',   data: CLASSES.map(c => data.leave[c]   || 0), borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,.08)',  tension: .4, pointRadius: 4, pointHoverRadius: 6, borderWidth: 2.5 },
        { label: 'ขาด',  data: CLASSES.map(c => data.absent[c]  || 0), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,.08)',  tension: .4, pointRadius: 4, pointHoverRadius: 6, borderWidth: 2.5 },
    ];

    if (state.chart) { state.chart.destroy(); state.chart = null; }

    state.chart = new Chart(canvas, {
        type: 'line',
        data: { labels: CLASSES, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: '#1e2636', borderColor: '#2a3448', borderWidth: 1, titleColor: '#e2e8f0', bodyColor: '#94a3b8', padding: 10 }
            },
            scales: {
                x: { grid: { color: 'rgba(42,52,72,.6)' }, ticks: { color: '#64748b', font: { size: 11 } } },
                y: { beginAtZero: true, grid: { color: 'rgba(42,52,72,.6)' }, ticks: { color: '#64748b', font: { size: 11 }, stepSize: 1 } }
            }
        }
    });
}

// ===== SEARCH =====
function openSearch() {
    document.getElementById('searchModal').classList.add('open');
    setTimeout(() => document.getElementById('searchInput')?.focus(), 100);
}
function closeSearch() {
    document.getElementById('searchModal').classList.remove('open');
    const el = document.getElementById('searchInput');
    if (el) el.value = '';
    document.getElementById('searchResults').innerHTML = '';
}
function doSearch(val) {
    const wrap = document.getElementById('searchResults');
    val = val.trim();
    if (!val) { wrap.innerHTML = ''; return; }
    const results = state.students.filter(s => s.name.includes(val) || String(s.number).includes(val)).slice(0, 10);
    if (results.length === 0) {
        wrap.innerHTML = `<div class="sr-empty">ไม่พบนักเรียนที่ตรงกับ "${val}"</div>`;
        return;
    }
    const escaped = val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'g');
    wrap.innerHTML = results.map(s => {
        const hlName = s.name.replace(re, m => `<span class="hl">${m}</span>`);
        return `<div class="sr-item" onclick="goToStudent('${s.id}')">
      <div class="sr-av">${s.number || '—'}</div>
      <div><div class="sr-name">${hlName}</div><div class="sr-sub">ชั้น ${s.class}${s.room ? ' · ห้อง ' + s.room : ''}</div></div>
    </div>`;
    }).join('');
}
function goToStudent(studentId) {
    closeSearch();
    const s = state.students.find(x => x.id === studentId);
    if (!s) return;
    showPage('students-list', document.querySelector('[data-page=students-list]'));
    const filter = document.getElementById('list-filter');
    if (filter) { filter.value = s.class; renderStudentList(); }
    setTimeout(() => {
        const card = document.getElementById('slc-' + studentId);
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.style.borderColor = 'var(--blue)';
            setTimeout(() => { card.style.borderColor = ''; }, 2000);
        }
    }, 200);
}

// ===== TOAST =====
function toast(msg, type = 's') {
    const wrap = document.getElementById('toast-wrap');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
        <i class="fas fa-${type === 's' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span style="flex:1">${msg}</span>
        <div class="toast-progress"></div>`;
    wrap.appendChild(el);
    // fade out before remove
    setTimeout(() => {
        el.style.transition = 'opacity .3s, transform .3s';
        el.style.opacity = '0';
        el.style.transform = 'translateX(16px)';
        setTimeout(() => el.remove(), 300);
    }, 2700);
}
