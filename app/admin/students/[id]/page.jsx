"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";

const TABS = [
  { id: "info", label: "Thông tin" },
  { id: "notes", label: "Ghi chú nội bộ" },
  { id: "audit", label: "Lịch sử quản trị" },
  { id: "path", label: "Lộ trình" },
  { id: "pro", label: "Gói Pro" },
];

function fmtDate(v) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  } catch {
    return "—";
  }
}

function actionLabel(action) {
  const map = {
    "student.update": "Cập nhật thông tin",
    "student.block": "Khóa tài khoản",
    "student.unblock": "Mở khóa tài khoản",
    "student.note.add": "Thêm ghi chú",
    "student_path.assign": "Gán lộ trình",
    "student_path.personal_update": "Chỉnh lộ trình cá nhân",
    "student_path.apply_template_update": "Áp dụng cập nhật mẫu",
    "student.pro.activate": "Kích hoạt Pro",
    "student.pro.extend": "Gia hạn Pro",
    "student.pro.revoke": "Thu hồi Pro",
  };
  return map[action] || action;
}

export default function AdminStudentDetailPage() {
  const params = useParams();
  const id = params?.id;
  const [tab, setTab] = useState("info");
  const [data, setData] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editReason, setEditReason] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [lockReason, setLockReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [pathTemplates, setPathTemplates] = useState([]);
  const [assignTemplateId, setAssignTemplateId] = useState("");
  const [pathGoal, setPathGoal] = useState("");
  const [pathDue, setPathDue] = useState("");
  const [applyReason, setApplyReason] = useState("");
  const [personalReason, setPersonalReason] = useState("");
  const [personalGoal, setPersonalGoal] = useState("");
  const [personalDue, setPersonalDue] = useState("");
  const [proAction, setProAction] = useState("extend");
  const [proDays, setProDays] = useState(30);
  const [proPlan, setProPlan] = useState("pro");
  const [proSource, setProSource] = useState("gift");
  const [proRef, setProRef] = useState("");
  const [proReason, setProReason] = useState("");
  const [proPreview, setProPreview] = useState(null);
  const [proIdempotency, setProIdempotency] = useState("");

  const can = (p) => permissions.includes(p);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/admin/students/${id}`, { cache: "no-store", credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Không tải được hồ sơ.");
      setData(json.data);
      setPermissions(json.permissions || []);
      setEditName(json.data.student.name || "");
      setEditPhone(json.data.student.phone || "");
    } catch (e) {
      setErr(e.message || "Lỗi");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!can("paths.assign")) return;
    (async () => {
      try {
        const res = await fetch("/api/admin/path-templates?status=published", { credentials: "same-origin" });
        const json = await res.json();
        if (res.ok && json.success) setPathTemplates(json.data || []);
      } catch {
        /* optional */
      }
    })();
  }, [permissions]);

  useEffect(() => {
    const lp = data?.learningPath;
    if (!lp?.assignment) return;
    setPersonalGoal(lp.assignment.goalText || "");
    setPersonalDue(lp.assignment.dueAt ? new Date(lp.assignment.dueAt).toISOString().slice(0, 16) : "");
  }, [data?.learningPath?.assignment?.id, data?.learningPath?.assignment?.goalText, data?.learningPath?.assignment?.dueAt]);

  async function saveProfile(e) {
    e.preventDefault();
    if (!can("students.edit")) return;
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch(`/api/admin/students/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, phone: editPhone || null, reason: editReason }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Không lưu được.");
      setMsg(json.message || "Đã lưu.");
      setEditReason("");
      setData(json.data);
    } catch (e) {
      setErr(e.message || "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  async function toggleBlock(block) {
    if (!can("students.lock")) return;
    const reason = lockReason.trim();
    if (!reason) {
      setErr("Hãy ghi lý do khóa/mở khóa.");
      return;
    }
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch(`/api/admin/students/${id}/block`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ block, reason }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Thao tác thất bại.");
      setMsg(json.message || "OK");
      setLockReason("");
      setData(json.data);
    } catch (e) {
      setErr(e.message || "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  async function proApi(body) {
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch(`/api/admin/students/${id}/pro`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Thao tác Pro thất bại");
      if (body.mode === "apply") {
        setMsg(json.message || "Đã cập nhật gói.");
        setProPreview(null);
        setProIdempotency("");
        await load();
      } else {
        setProPreview(json.data);
        if (!proIdempotency) setProIdempotency(typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
      }
    } catch (e) {
      setErr(e.message || "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  async function pathAction(body) {
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch(`/api/admin/students/${id}/path`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Thao tác thất bại");
      setMsg(json.message || "OK");
      await load();
    } catch (e) {
      setErr(e.message || "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  async function addNote(e) {
    e.preventDefault();
    if (!can("students.notes.write")) return;
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch(`/api/admin/students/${id}/notes`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Không lưu ghi chú.");
      setMsg(json.message || "Đã lưu ghi chú.");
      setNoteBody("");
      setData(json.data);
    } catch (e) {
      setErr(e.message || "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminShell title="Hồ sơ học viên">
        <p className="adm-msg">Đang tải hồ sơ…</p>
      </AdminShell>
    );
  }

  if (err && !data) {
    return (
      <AdminShell title="Hồ sơ học viên">
        <p className="adm-err">{err}</p>
        <Link href="/admin/students" className="adm-back">← Danh sách học viên</Link>
      </AdminShell>
    );
  }

  if (!data) return null;

  const { student, subscription, notes, audit, tabs, learningPath, proPlan: proData } = data;

  return (
    <AdminShell
      title={`${student.name} (${student.code})`}
      subtitle={`${student.login_method_label} · ${student.verification_label}`}
    >
      <p className="adm-breadcrumb">
        <Link href="/admin/students">Học viên</Link> / {student.code}
      </p>
      {msg ? <p className="adm-success">{msg}</p> : null}
      {err ? <p className="adm-err">{err}</p> : null}

      <nav className="adm-tabs" aria-label="Tab hồ sơ">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`adm-tab ${tab === t.id ? "is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "info" ? (
        <section className="adm-card">
          <dl className="adm-dl">
            <div><dt>Mã học viên</dt><dd>{student.code}</dd></div>
            <div><dt>Email</dt><dd>{student.email || "—"}</dd></div>
            <div><dt>Phương thức đăng nhập</dt><dd>{student.login_method_label}</dd></div>
            <div><dt>Xác minh</dt><dd>{student.verification_label}</dd></div>
            <div><dt>Ngày đăng ký</dt><dd>{fmtDate(student.created_at)}</dd></div>
            <div><dt>Đăng nhập gần nhất</dt><dd>{fmtDate(student.last_login_at)}</dd></div>
            <div><dt>Gói hiện tại</dt><dd>{subscription.plan_state} ({subscription.plan})</dd></div>
            <div><dt>Trạng thái tài khoản</dt><dd>{student.account_status_label}</dd></div>
          </dl>

          {can("students.edit") ? (
            <form className="adm-form" onSubmit={saveProfile}>
              <h2>Sửa thông tin</h2>
              <label>
                Họ tên
                <input className="adm-input adm-input--block" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </label>
              <label>
                Số điện thoại
                <input
                  className="adm-input adm-input--block"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  disabled={student.login_method === "google"}
                  placeholder={student.login_method === "google" ? "Tài khoản Google" : ""}
                />
              </label>
              <label>
                Lý do thay đổi (bắt buộc khi lưu)
                <input className="adm-input adm-input--block" value={editReason} onChange={(e) => setEditReason(e.target.value)} />
              </label>
              <button type="submit" className="adm-btn adm-btn--primary" disabled={saving}>
                Lưu thay đổi
              </button>
            </form>
          ) : null}

          {can("students.lock") ? (
            <div className="adm-form adm-form--danger">
              <h2>Khóa / mở khóa</h2>
              <label>
                Lý do
                <input className="adm-input adm-input--block" value={lockReason} onChange={(e) => setLockReason(e.target.value)} />
              </label>
              <div className="adm-toolbar">
                {student.account_status === "active" ? (
                  <button type="button" className="adm-btn adm-btn--danger" disabled={saving} onClick={() => toggleBlock(true)}>
                    Khóa tài khoản
                  </button>
                ) : (
                  <button type="button" className="adm-btn adm-btn--primary" disabled={saving} onClick={() => toggleBlock(false)}>
                    Mở khóa tài khoản
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "notes" ? (
        <section className="adm-card">
          {can("students.notes.write") ? (
            <form className="adm-form" onSubmit={addNote}>
              <label>
                Ghi chú nội bộ (chỉ nhân viên Beego)
                <textarea
                  className="adm-textarea"
                  rows={4}
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                />
              </label>
              <button type="submit" className="adm-btn adm-btn--primary" disabled={saving}>
                Lưu ghi chú
              </button>
            </form>
          ) : null}
          {notes?.length ? (
            <ul className="adm-note-list">
              {notes.map((n) => (
                <li key={n.id}>
                  <p>{n.body}</p>
                  <small>
                    {n.author_name} · {fmtDate(n.created_at)}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="adm-empty">Chưa có ghi chú nội bộ.</p>
          )}
        </section>
      ) : null}

      {tab === "audit" ? (
        <section className="adm-card">
          {can("audit.read") && audit?.length ? (
            <ul className="adm-audit-list">
              {audit.map((row) => (
                <li key={row.id}>
                  <strong>{actionLabel(row.action)}</strong>
                  <span> — {row.actor.name}</span>
                  <div>{fmtDate(row.created_at)}</div>
                  {row.reason ? <p>Lý do: {row.reason}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="adm-empty">Chưa có lịch sử quản trị cho học viên này.</p>
          )}
        </section>
      ) : null}

      {tab === "path" ? (
        <section className="adm-card">
          <p className="adm-msg">{learningPath?.completionRule}</p>
          {!learningPath?.hasAssignment ? (
            <>
              <p className="adm-empty">Học viên chưa được gán lộ trình mẫu. Tiến độ tab Học vẫn lưu trong hệ thống.</p>
              {can("paths.assign") ? (
                <form
                  className="adm-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    pathAction({
                      templateId: Number(assignTemplateId),
                      goalText: pathGoal,
                      dueAt: pathDue || null,
                    });
                  }}
                >
                  <label>
                    Lộ trình mẫu (đã xuất bản)
                    <select className="adm-input adm-input--block" value={assignTemplateId} onChange={(e) => setAssignTemplateId(e.target.value)} required>
                      <option value="">— Chọn —</option>
                      {pathTemplates.map((t) => (
                        <option key={t.id} value={t.id}>{t.title} (v{t.version})</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Mục tiêu (tùy chọn)
                    <input className="adm-input adm-input--block" value={pathGoal} onChange={(e) => setPathGoal(e.target.value)} />
                  </label>
                  <label>
                    Hạn hoàn thành (tùy chọn)
                    <input type="datetime-local" className="adm-input adm-input--block" value={pathDue} onChange={(e) => setPathDue(e.target.value)} />
                  </label>
                  <button type="submit" className="adm-btn adm-btn--primary" disabled={saving}>Gán lộ trình</button>
                </form>
              ) : null}
            </>
          ) : (
            <>
              <div className="adm-stats">
                <div className="adm-stat">
                  <div className="k">Tiến độ</div>
                  <div className="v">{learningPath.summary?.progressPct ?? 0}%</div>
                </div>
                <div className="adm-stat">
                  <div className="k">Hoàn thành</div>
                  <div className="v">{learningPath.summary?.completedCount ?? 0}/{learningPath.summary?.total ?? 0}</div>
                </div>
                <div className="adm-stat">
                  <div className="k">Đang học</div>
                  <div className="v">{learningPath.summary?.inProgressCount ?? 0}</div>
                </div>
                <div className="adm-stat">
                  <div className="k">Học gần nhất</div>
                  <div className="v" style={{ fontSize: "0.85rem" }}>{fmtDate(learningPath.summary?.lastStudyAt)}</div>
                </div>
              </div>
              <p className="adm-msg">
                <strong>{learningPath.assignment?.title}</strong>
                {learningPath.assignment?.goalText ? ` · ${learningPath.assignment.goalText}` : ""}
                {learningPath.assignment?.dueAt ? ` · Hạn: ${fmtDate(learningPath.assignment.dueAt)}` : ""}
              </p>
              {can("paths.assign.personal") ? (
                <form
                  className="adm-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    pathAction({
                      action: "personal_update",
                      assignmentId: learningPath.assignment?.id,
                      reason: personalReason,
                      goalText: personalGoal,
                      dueAt: personalDue || null,
                    });
                  }}
                >
                  <h3 style={{ margin: "0.5rem 0 0" }}>Chỉnh lộ trình cá nhân</h3>
                  <p className="adm-msg">Thay đổi chỉ áp dụng học viên này, không ảnh hưởng mẫu hay học viên khác.</p>
                  <label>
                    Mục tiêu
                    <input className="adm-input adm-input--block" value={personalGoal} onChange={(e) => setPersonalGoal(e.target.value)} />
                  </label>
                  <label>
                    Hạn hoàn thành
                    <input type="datetime-local" className="adm-input adm-input--block" value={personalDue} onChange={(e) => setPersonalDue(e.target.value)} />
                  </label>
                  <label>
                    Lý do (bắt buộc)
                    <input className="adm-input adm-input--block" value={personalReason} onChange={(e) => setPersonalReason(e.target.value)} required />
                  </label>
                  <button type="submit" className="adm-btn" disabled={saving}>Lưu chỉnh cá nhân</button>
                </form>
              ) : null}
              {learningPath.templateUpdateAvailable && can("paths.apply_update") ? (
                <div className="adm-form">
                  <p className="adm-msg">Có phiên bản mẫu mới (v{learningPath.latestTemplateVersion}). Áp dụng sẽ chỉ thêm bài mới, giữ tiến độ đã học.</p>
                  <input className="adm-input adm-input--block" placeholder="Lý do áp dụng cập nhật" value={applyReason} onChange={(e) => setApplyReason(e.target.value)} />
                  <button
                    type="button"
                    className="adm-btn adm-btn--primary"
                    disabled={saving || !applyReason.trim()}
                    onClick={() =>
                      pathAction({
                        action: "apply_template_update",
                        assignmentId: learningPath.assignment?.id,
                        reason: applyReason.trim(),
                      })
                    }
                  >
                    Áp dụng cập nhật mẫu
                  </button>
                </div>
              ) : null}
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>Bài</th>
                      <th>Cửa</th>
                      <th>Trạng thái</th>
                      <th>Điểm / thi</th>
                      <th>Hoàn thành</th>
                    </tr>
                  </thead>
                  <tbody>
                    {learningPath.items?.map((row) => (
                      <tr key={row.lessonId}>
                        <td>{row.title}<br /><small>{row.lessonId}</small></td>
                        <td>{row.gateNumber}</td>
                        <td>{row.statusLabel}</td>
                        <td>{row.itemType === "exam" && row.score != null ? `${row.score}%` : row.score != null ? row.score : "—"}</td>
                        <td>{fmtDate(row.completedAt || row.lastAttemptAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      ) : null}

      {tab === "pro" ? (
        <section className="adm-card">
          <p className="adm-msg">{proData?.accessNote}</p>
          <div className="adm-stats">
            <div className="adm-stat">
              <div className="k">Trạng thái</div>
              <div className="v">{subscription.plan_state}</div>
            </div>
            <div className="adm-stat">
              <div className="k">Gói</div>
              <div className="v">{subscription.plan}</div>
            </div>
            <div className="adm-stat">
              <div className="k">Bắt đầu (Pro)</div>
              <div className="v" style={{ fontSize: "0.85rem" }}>{subscription.subscribed_at_vi || fmtDate(subscription.subscribed_at)}</div>
            </div>
            <div className="adm-stat">
              <div className="k">Hết hạn</div>
              <div className="v" style={{ fontSize: "0.85rem" }}>{subscription.expires_at_vi || fmtDate(subscription.expires_at)}</div>
            </div>
          </div>
          {subscription.plan_state === "trial" ? (
            <p className="adm-msg">Dùng thử đến: {subscription.trial_end_at_vi || fmtDate(subscription.trial_end_at)}</p>
          ) : null}

          {can("students.plan") ? (
            <form
              className="adm-form"
              onSubmit={(e) => {
                e.preventDefault();
                proApi({
                  mode: "preview",
                  action: proAction,
                  plan: proPlan,
                  days: Number(proDays),
                });
              }}
            >
              <h3 style={{ margin: "0.5rem 0 0" }}>Quản lý Pro</h3>
              <label>
                Thao tác
                <select className="adm-input adm-input--block" value={proAction} onChange={(e) => { setProAction(e.target.value); setProPreview(null); }}>
                  <option value="activate">Kích hoạt</option>
                  <option value="extend">Gia hạn</option>
                  <option value="revoke">Thu hồi</option>
                </select>
              </label>
              {proAction !== "revoke" ? (
                <>
                  <label>
                    Gói
                    <select className="adm-input adm-input--block" value={proPlan} onChange={(e) => setProPlan(e.target.value)}>
                      <option value="pro">Pro</option>
                      <option value="vip">VIP</option>
                    </select>
                  </label>
                  <label>
                    Số ngày
                    <input type="number" min={1} max={730} className="adm-input adm-input--block" value={proDays} onChange={(e) => setProDays(e.target.value)} />
                  </label>
                  <label>
                    Nguồn kích hoạt
                    <select className="adm-input adm-input--block" value={proSource} onChange={(e) => setProSource(e.target.value)}>
                      <option value="payment">Thanh toán</option>
                      <option value="bank_transfer">Chuyển khoản</option>
                      <option value="gift">Tặng</option>
                      <option value="scholarship">Học bổng</option>
                      <option value="trial">Dùng thử</option>
                    </select>
                  </label>
                  <label>
                    Mã giao dịch (tùy chọn)
                    <input className="adm-input adm-input--block" value={proRef} onChange={(e) => setProRef(e.target.value)} />
                  </label>
                </>
              ) : (
                <label>
                  Lý do thu hồi (bắt buộc)
                  <input className="adm-input adm-input--block" value={proReason} onChange={(e) => setProReason(e.target.value)} required />
                </label>
              )}
              <button type="submit" className="adm-btn" disabled={saving}>Xem trước thời hạn</button>
            </form>
          ) : null}

          {proPreview && can("students.plan") ? (
            <div className="adm-form adm-pro-preview">
              <p className="adm-msg">
                <strong>Hiện tại:</strong> {proPreview.current?.planState} — hết hạn {proPreview.current?.expiresAtVi || "—"}
              </p>
              <p className="adm-msg">
                <strong>Sau thao tác:</strong> {proPreview.preview?.planState} — hết hạn {proPreview.preview?.expiresAtVi || "—"}
              </p>
              <button
                type="button"
                className="adm-btn adm-btn--primary"
                disabled={saving || (proAction === "revoke" && !proReason.trim())}
                onClick={() =>
                  proApi({
                    mode: "apply",
                    action: proAction,
                    plan: proPlan,
                    days: Number(proDays),
                    activationSource: proAction === "revoke" ? undefined : proSource,
                    externalRef: proRef || null,
                    reason: proAction === "revoke" ? proReason.trim() : proReason || null,
                    idempotencyKey: proIdempotency || undefined,
                  })
                }
              >
                Xác nhận cập nhật gói
              </button>
            </div>
          ) : null}

          {proData?.ledger?.length ? (
            <>
              <h3>Nhật ký gói Pro</h3>
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>Thời điểm</th>
                      <th>Thao tác</th>
                      <th>Nguồn</th>
                      <th>Hết hạn cũ → mới</th>
                      <th>Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proData.ledger.map((row) => (
                      <tr key={row.id}>
                        <td>{row.createdAtVi || fmtDate(row.createdAt)}</td>
                        <td>{row.action}<br /><small>{row.actorName}</small></td>
                        <td>{row.activationSource || "—"}{row.externalRef ? <><br /><small>{row.externalRef}</small></> : null}</td>
                        <td>{row.oldExpiresAtVi || "—"} → {row.newExpiresAtVi || "—"}</td>
                        <td>{row.countsAsRevenue ? "Có" : "Không"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="adm-empty">Chưa có thao tác Pro từ quản trị.</p>
          )}
        </section>
      ) : null}
    </AdminShell>
  );
}
