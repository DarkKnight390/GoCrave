import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  activateSubscription,
  createRunnerRecord,
  deactivateRunner,
  isPhoneAvailable,
  isRunnerIdAvailable,
  listenRunners,
  listenSubscriptions,
  reserveRunnerId,
  reactivateRunner,
  updateRunner,
} from "../../services/runners.service";
import { deleteRunnerAdmin } from "../../services/runnerAdmin.service";
import { secondaryAuth } from "../../services/firebase";
import {
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";

const idTypes = ["DRIVER_LICENSE", "VOTERS_ID", "PASSPORT"];

const escapeCsv = (value) => {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/\"/g, "\"\"")}"`;
  }
  return s;
};

const maskKeepLast = (value, last) => {
  const s = String(value || "");
  if (s.length <= last) return "*".repeat(s.length);
  return "*".repeat(s.length - last) + s.slice(-last);
};

const sha256 = async (value) => {
  const data = new TextEncoder().encode(String(value || ""));
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(hash));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
};

export default function AdminRunners() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [editingRunner, setEditingRunner] = useState(null);
  const [runners, setRunners] = useState([]);
  const [subscriptions, setSubscriptions] = useState({});
  const listRef = useRef(null);

  const [form, setForm] = useState({
    name: "",
    dob: "",
    age: "",
    address: "",
    trn: "",
    idType: "DRIVER_LICENSE",
    idNumber: "",
    runnerId: "GC",
    phone: "+1876",
    runnerType: "goCrave",
    loginEmail: "",
    tempPassword: "",
    acceptTerms: false,
  });

  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    address: "",
    status: "active",
  });

  useEffect(() => {
    const unsub = listenRunners((list) => setRunners(list));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = listenSubscriptions((data) => setSubscriptions(data));
    return () => unsub();
  }, []);

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const generateRunnerId = async () => {
    for (let i = 0; i < 6; i += 1) {
      const id = `GC${Math.floor(1000 + Math.random() * 9000)}`;
      const available = await isRunnerIdAvailable(id);
      if (available) {
        setField("runnerId", id);
        return;
      }
    }
    setMsg("Could not find an available Runner ID. Try again.");
  };

  const generateLoginEmail = () => {
    const id = `User${Math.floor(100 + Math.random() * 900)}@GoCrave.com`;
    setField("loginEmail", id);
  };

  const generateTempPassword = () => {
    const base = Math.random().toString(36).slice(-6).toUpperCase();
    setField("tempPassword", `GC@${base}${Math.floor(Math.random() * 90 + 10)}`);
  };

  const validate = () => {
    const req = [
      "name",
      "dob",
      "age",
      "address",
      "trn",
      "idNumber",
      "runnerId",
      "phone",
      "loginEmail",
      "tempPassword",
    ];
    for (const k of req) {
      if (!String(form[k] ?? "").trim()) return `Missing: ${k}`;
    }
    if (!/^GC\d{4,}$/i.test(form.runnerId.trim())) {
      return "Runner ID must look like GC8373";
    }
    if (!form.acceptTerms) return "Terms and policy must be accepted.";
    return null;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    const err = validate();
    if (err) return setMsg(err);

    setSaving(true);
    try {
      const runnerId = form.runnerId.trim().toUpperCase();
      const phone = form.phone.trim();

      const runnerAvailable = await isRunnerIdAvailable(runnerId);
      if (!runnerAvailable) throw new Error("Runner ID already exists.");

      const phoneAvailable = await isPhoneAvailable(phone);
      if (!phoneAvailable) throw new Error("Phone already linked to another runner.");

      const trnMasked = maskKeepLast(form.trn.trim(), 3);
      const idMasked = maskKeepLast(form.idNumber.trim(), 4);
      const trnHash = `sha256:${await sha256(form.trn.trim())}`;
      const idHash = `sha256:${await sha256(form.idNumber.trim())}`;

      const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        form.loginEmail.trim().toLowerCase(),
        form.tempPassword.trim()
      );

      await createRunnerRecord({
        runnerId,
        runnerType: form.runnerType === "independent" ? "independent" : "goCrave",
        authUid: credential.user.uid,
        loginEmail: form.loginEmail.trim().toLowerCase(),
        name: form.name.trim(),
        dob: form.dob.trim(),
        age: Number(form.age),
        address: form.address.trim(),
        phone,
        trnMasked,
        trnHash,
        idType: form.idType,
        idMasked,
        idHash,
      });

      await signOut(secondaryAuth);
      setMsg(`Created ${runnerId} (${form.runnerType}) for ${form.loginEmail}`);
    } catch (e2) {
      setMsg(e2?.message || "Failed to create runner");
    } finally {
      setSaving(false);
    }
  };

  const filteredRunners = useMemo(() => {
    if (!search.trim()) return runners;
    const q = search.toLowerCase();
    return runners.filter((r) => {
      return (
        r.name?.toLowerCase().includes(q) ||
        r.runnerId?.toLowerCase().includes(q) ||
        r.phone?.toLowerCase().includes(q)
      );
    });
  }, [runners, search]);

  const exportCsv = () => {
    const headers = [
      "runnerId",
      "name",
      "runnerType",
      "status",
      "phone",
      "loginEmail",
    ];
    const rows = filteredRunners.map((r) => [
      r.runnerId,
      r.name,
      r.runnerType,
      r.status || "active",
      r.phone || "",
      r.loginEmail || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join(
      "\n"
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "gocrave-runners.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const startEdit = (runner) => {
    setEditingRunner(runner);
    setEditForm({
      name: runner.name || "",
      phone: runner.phone || "",
      address: runner.address || "",
      status: runner.status || "active",
    });
  };

  const saveEdit = async () => {
    if (!editingRunner) return;
    await updateRunner(editingRunner.runnerType, editingRunner.runnerId, {
      name: editForm.name,
      phone: editForm.phone,
      address: editForm.address,
      status: editForm.status,
    });
    setEditingRunner(null);
  };

  return (
    <div>
      <div className="gc-adminCard">
        <div className="gc-adminCardHeader">
          <div>
            <div className="gc-adminCardTitle">Create Runner</div>
            <div className="gc-adminCardSub">
              GoCrave creates runners for customer safety. Independent runners pay J$5000 per month.
            </div>
          </div>
          <button
            className="gc-adminPrimary"
            type="button"
            onClick={() => listRef.current?.scrollIntoView({ behavior: "smooth" })}
          >
            View runners
          </button>
        </div>

        <form onSubmit={onSubmit} className="gc-formGrid">
          <input
            className="gc-input"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
          />
          <input
            className="gc-input"
            type="date"
            value={form.dob}
            onChange={(e) => setField("dob", e.target.value)}
          />
          <input
            className="gc-input"
            placeholder="Age"
            value={form.age}
            onChange={(e) => setField("age", e.target.value)}
          />
          <input
            className="gc-input"
            placeholder="Address"
            value={form.address}
            onChange={(e) => setField("address", e.target.value)}
          />

          <input
            className="gc-input"
            placeholder="TRN"
            value={form.trn}
            onChange={(e) => setField("trn", e.target.value)}
          />

          <select
            className="gc-input"
            value={form.idType}
            onChange={(e) => setField("idType", e.target.value)}
          >
            {idTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <input
            className="gc-input"
            placeholder="ID Number"
            value={form.idNumber}
            onChange={(e) => setField("idNumber", e.target.value)}
          />
          <input
            className="gc-input"
            placeholder="Runner ID (GC8373)"
            value={form.runnerId}
            onChange={(e) => setField("runnerId", e.target.value)}
          />
          <button className="gc-adminGhost" type="button" onClick={generateRunnerId}>
            Generate Runner ID
          </button>
          <input
            className="gc-input"
            placeholder="Phone (+1876...)"
            value={form.phone}
            onChange={(e) => setField("phone", e.target.value)}
          />

          <select
            className="gc-input"
            value={form.runnerType}
            onChange={(e) => setField("runnerType", e.target.value)}
          >
            <option value="goCrave">GoCrave Runner</option>
            <option value="independent">Independent Runner</option>
          </select>

          <input
            className="gc-input"
            placeholder="Login Email"
            value={form.loginEmail}
            onChange={(e) => setField("loginEmail", e.target.value)}
          />
          <button className="gc-adminGhost" type="button" onClick={generateLoginEmail}>
            Generate Email
          </button>
          <input
            className="gc-input"
            placeholder="Temp Password"
            value={form.tempPassword}
            onChange={(e) => setField("tempPassword", e.target.value)}
          />
          <button className="gc-adminGhost" type="button" onClick={generateTempPassword}>
            Generate Password
          </button>

          <label className="gc-checkboxRow">
            <input
              type="checkbox"
              checked={form.acceptTerms}
              onChange={(e) => setField("acceptTerms", e.target.checked)}
            />
            I confirm runner accepted Terms and Policy
          </label>

          <button className="gc-btn" disabled={saving}>
            {saving ? "Creating..." : "Create Runner"}
          </button>

          {msg && <p className={msg.startsWith("Created") ? "gc-formSub" : "gc-error"}>{msg}</p>}
        </form>
      </div>

      <div className="gc-panel" style={{ marginTop: 16 }} ref={listRef}>
        <div className="gc-filterBar">
          <h3 className="gc-panelTitle">Runners</h3>
          <input
            className="gc-input"
            placeholder="Search by name, runner ID, or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="gc-adminGhost" type="button" onClick={exportCsv}>
            Export CSV
          </button>
        </div>

        {filteredRunners.length === 0 ? (
          <p className="gc-muted">No runners found.</p>
        ) : (
          <div className="gc-runnerList">
            {filteredRunners.map((runner) => {
              const sub = subscriptions[runner.runnerId];
              const isActive = runner.status !== "inactive" && runner.status !== "suspended";
              const daysLeft =
                runner.runnerType === "independent" && sub?.activeUntil
                  ? Math.ceil((sub.activeUntil - Date.now()) / (24 * 60 * 60 * 1000))
                  : null;
              return (
                <div key={runner.runnerId} className="gc-menuItem" style={{ alignItems: "center" }}>
                  <div>
                    <div className="gc-menuName">
                      {runner.name} - {runner.runnerId}
                    </div>
                    <div className="gc-muted" style={{ fontSize: 12 }}>
                      {runner.runnerType} - {runner.phone || "-"} - {runner.status || "active"}
                    </div>
                    {runner.runnerType === "independent" && sub && (
                      <div className="gc-muted" style={{ fontSize: 12 }}>
                        Subscription: {sub.status || "inactive"}
                      </div>
                    )}
                    {daysLeft !== null && daysLeft >= 0 && (
                      <span className={"gc-adminBadge" + (daysLeft <= 7 ? " isWarn" : "")}>
                        {daysLeft} days left
                      </span>
                    )}
                  </div>

                  <div className="gc-inlineActions">
                    <button
                      className="gc-miniBtn"
                      type="button"
                      onClick={() => navigate(`/admin/runners/${runner.runnerId}`)}
                    >
                      View
                    </button>
                    <button className="gc-miniBtn" type="button" onClick={() => startEdit(runner)}>
                      Edit
                    </button>
                    <button
                      className="gc-dangerBtn"
                      type="button"
                      onClick={async () => {
                        const ok = confirm(
                          `Delete ${runner.name} (${runner.runnerId})? This removes all runner data from RTDB.`
                        );
                        if (!ok) return;
                        try {
                          await deleteRunnerAdmin(runner.runnerId);
                        } catch (err) {
                          console.error(err);
                          alert("Delete failed. Check server and rules.");
                        }
                      }}
                    >
                      Delete
                    </button>
                    {isActive ? (
                      <button
                        className="gc-dangerBtn"
                        type="button"
                        onClick={() => deactivateRunner(runner.runnerType, runner.runnerId)}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        className="gc-miniBtn"
                        type="button"
                        onClick={() => reactivateRunner(runner.runnerType, runner.runnerId)}
                      >
                        Reactivate
                      </button>
                    )}
                    {runner.runnerType === "independent" && (
                      <button
                        className="gc-miniBtn"
                        type="button"
                        onClick={() => activateSubscription(runner.runnerId, 30)}
                      >
                        Activate 30 days
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editingRunner && (
        <div className="gc-panel" style={{ marginTop: 16 }}>
          <h3 className="gc-panelTitle">Edit Runner</h3>
          <div className="gc-formGrid">
            <input
              className="gc-input"
              placeholder="Name"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
            <input
              className="gc-input"
              placeholder="Phone"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            />
            <input
              className="gc-input"
              placeholder="Address"
              value={editForm.address}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
            />
            <select
              className="gc-input"
              value={editForm.status}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div className="gc-inlineActions" style={{ marginTop: 12 }}>
            <button className="gc-btn" type="button" onClick={saveEdit}>
              Save changes
            </button>
            <button className="gc-miniBtn" type="button" onClick={() => setEditingRunner(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
