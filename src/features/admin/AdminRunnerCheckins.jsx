import { useEffect, useMemo, useState } from "react";
import AdminDataTable from "./components/shared/AdminDataTable";
import {
  listenRunnerCheckins,
  listenRunners,
  listenRunnerMetricsAll,
  listenRunnersCoreAll,
} from "../../services/runners.service";
import { listenOrders } from "../../services/rtdb.service";
import avatar1 from "../../assets/avatars/runner1.jpg";
import avatar2 from "../../assets/avatars/runner2.jpg";
import avatar3 from "../../assets/avatars/runner3.jpg";
import avatar4 from "../../assets/avatars/runner4.jpg";
import avatar5 from "../../assets/avatars/runner5.jpg";

const formatDateTime = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "-";
  }
};

const formatDate = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return "-";
  }
};

const formatMinutes = (mins) => {
  const total = Number(mins || 0);
  const hrs = Math.floor(total / 60);
  const rem = total % 60;
  return `${hrs}h ${rem}m`;
};

const money = (n) =>
  new Intl.NumberFormat("en-JM", { style: "currency", currency: "JMD" }).format(
    n || 0
  );

const weeklyPayJmd = 20000;

const avatars = [avatar1, avatar2, avatar3, avatar4, avatar5];

const pickAvatar = (runnerId, name) => {
  const key = `${runnerId || ""}${name || ""}`;
  if (!key) return avatars[0];
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 100000;
  }
  return avatars[Math.abs(hash) % avatars.length];
};

export default function AdminRunnerCheckins() {
  const [checkins, setCheckins] = useState({});
  const [runners, setRunners] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [runnerCore, setRunnerCore] = useState({});
  const [orders, setOrders] = useState([]);
  const [selectedRunnerId, setSelectedRunnerId] = useState(null);
  const [query, setQuery] = useState("");
  const [runnerType, setRunnerType] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [rangePreset, setRangePreset] = useState("14");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedDay, setSelectedDay] = useState("");

  useEffect(() => {
    const unsub = listenRunnerCheckins(setCheckins);
    return () => unsub?.();
  }, []);

  useEffect(() => {
    const unsub = listenRunners(setRunners);
    return () => unsub?.();
  }, []);

  useEffect(() => {
    const unsub = listenRunnerMetricsAll(setMetrics);
    return () => unsub?.();
  }, []);

  useEffect(() => {
    const unsub = listenRunnersCoreAll(setRunnerCore);
    return () => unsub?.();
  }, []);

  useEffect(() => {
    const unsub = listenOrders(setOrders);
    return () => unsub?.();
  }, []);

  const runnerMap = useMemo(() => {
    const map = {};
    const list = Array.isArray(runners) ? runners : [];
    list.forEach((runner) => {
      if (runner?.runnerId) map[runner.runnerId] = runner;
    });
    return map;
  }, [runners]);

  const { startMs, endMs, rangeLabel } = useMemo(() => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    if (rangePreset === "custom" && customStart) {
      const startDate = new Date(customStart);
      const endDate = customEnd ? new Date(customEnd) : new Date(customStart);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      return {
        startMs: startDate.getTime(),
        endMs: endDate.getTime(),
        rangeLabel: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
      };
    }

    const days = Number(rangePreset || 14);
    const start = new Date(end);
    start.setDate(end.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
    return {
      startMs: start.getTime(),
      endMs: end.getTime(),
      rangeLabel: `Last ${days} days: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
    };
  }, [rangePreset, customStart, customEnd]);

  const ordersByRunner = useMemo(() => {
    const map = {};
    const cancelledMap = {};
    const list = Array.isArray(orders) ? orders : [];
    list.forEach((order) => {
      if (!order?.runnerId) return;
      const deliveredAt =
        order?.statusTimestamps?.delivered ||
        order?.deliveredAt ||
        order?.updatedAt ||
        0;
      const cancelledAt =
        order?.statusTimestamps?.cancelled ||
        order?.cancelledAt ||
        order?.updatedAt ||
        0;
      if (order?.status === "cancelled" && cancelledAt && cancelledAt >= startMs && cancelledAt <= endMs) {
        if (!cancelledMap[order.runnerId]) cancelledMap[order.runnerId] = [];
        cancelledMap[order.runnerId].push(order);
      }

      if (order?.status === "delivered" && deliveredAt && deliveredAt >= startMs && deliveredAt <= endMs) {
        if (!map[order.runnerId]) map[order.runnerId] = [];
        map[order.runnerId].push(order);
      }
    });
    return { delivered: map, cancelled: cancelledMap };
  }, [orders, startMs, endMs]);

  const rows = useMemo(() => {
    const list = [];
    const coreKeys =
      runnerCore && typeof runnerCore === "object" ? Object.keys(runnerCore) : [];
    const checkinKeys =
      checkins && typeof checkins === "object" ? Object.keys(checkins) : [];
    const runnerIds = Array.from(
      new Set([
        ...Object.keys(runnerMap || {}),
        ...coreKeys,
        ...checkinKeys,
      ])
    );

    for (const runnerId of runnerIds) {
      if (!runnerId) continue;
      const runnerKey = String(runnerId).toLowerCase();
      if (runnerKey === "gocrave" || runnerKey === "independent") continue;
      const entriesRaw = checkins?.[runnerId];
      const entries =
        entriesRaw && typeof entriesRaw === "object" ? entriesRaw : {};
      const runner = runnerMap?.[runnerId] || {};
      const core = runnerCore?.[runnerId] || {};
      const runnerName = String(runner?.name || core?.name || "").trim();
      if (!runnerName || runnerName.toLowerCase() === "runner") continue;
      const runnerStatus = core?.status || runner?.status || "active";
      const entryList = Object.entries(entries)
        .map(([checkinId, entry]) => ({
          id: checkinId,
          at:
            entry?.checkinAt ||
            entry?.startAt ||
            Number(checkinId) ||
            0,
          startAt:
            entry?.startAt ||
            entry?.checkinAt ||
            Number(checkinId) ||
            0,
          endAt: entry?.endAt || 0,
          minutes: Number(entry?.minutes || 0),
          status: entry?.status || "online",
        }))
        .filter((item) => item.at >= startMs && item.at <= endMs);

      entryList.sort((a, b) => b.at - a.at);
      const latestStatus = entryList[0]?.status || "offline";
      const availability =
        runner?.availability ||
        core?.availability ||
        latestStatus ||
        "offline";
      if (runnerType !== "all") {
        const typeVal = String(
          runner?.runnerType || runner?.type || core?.type || ""
        ).toLowerCase();
        if (runnerType === "goCrave") {
          if (typeVal !== "gocrave" && typeVal !== "company") continue;
        } else if (typeVal !== runnerType) {
          continue;
        }
      }
      if (statusFilter !== "all") {
        const statusVal = String(runnerStatus || "").toLowerCase();
        if (statusFilter === "active" && statusVal !== "active") continue;
        if (statusFilter === "inactive" && statusVal === "active") continue;
      }
      const daysWorked = new Set(entryList.map((item) => formatDate(item.at))).size;
      const lastSeen =
        entryList[0]?.at ||
        core?.lastActiveAt ||
        0;
      const onlineMinutes = entryList.reduce((sum, item) => {
        if (item.minutes) return sum + item.minutes;
        if (item.startAt && item.endAt) {
          return sum + Math.max(0, Math.round((item.endAt - item.startAt) / 60000));
        }
        if (item.startAt && !item.endAt) {
          return sum + Math.max(0, Math.round((Math.min(Date.now(), endMs) - item.startAt) / 60000));
        }
        return sum;
      }, 0);

      const runnerOrders = ordersByRunner.delivered?.[runnerId] || [];
      const runnerCancelled = ordersByRunner.cancelled?.[runnerId] || [];
      const ordersCompleted = runnerOrders.length;
      const cancelledCount = runnerCancelled.length;
      const avgOrders = daysWorked ? (ordersCompleted / daysWorked).toFixed(1) : "0.0";
      const payDue = Math.round((daysWorked / 7) * weeklyPayJmd);

      list.push({
        id: runnerId,
        runnerId,
        runnerName: runnerName || "Runner",
        runnerType: runner?.runnerType || runner?.type || "-",
        daysWorked,
        onlineTime: formatMinutes(onlineMinutes),
        ordersCompleted,
        cancelled: cancelledCount,
        avgOrders,
        lastSeen,
        availability,
        runnerStatus,
        payrollStatus: runner?.payrollLocked ? "Locked" : "Open",
        payDue,
      });
    }
    list.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));

    const filtered = list.filter((row) => {
      const term = query.trim().toLowerCase();
      if (!term) return true;
      return (
        row.runnerName.toLowerCase().includes(term) ||
        String(row.runnerId).toLowerCase().includes(term)
      );
    });

    return filtered;
  }, [
    checkins,
    runnerMap,
    metrics,
    query,
    runnerType,
    statusFilter,
    ordersByRunner,
    startMs,
    endMs,
    runnerCore,
  ]);

  const safeRows = Array.isArray(rows) ? rows : [];
  const selectedRunner =
    safeRows.find((row) => row.runnerId === selectedRunnerId) || safeRows[0];

  useEffect(() => {
    if (!selectedRunnerId && safeRows.length) {
      setSelectedRunnerId(safeRows[0].runnerId);
    }
  }, [safeRows, selectedRunnerId]);

  const summary = useMemo(() => {
    const list = Array.isArray(rows) ? rows : [];
    const totalRunners = list.length;
    const daysWorked = list.reduce((sum, row) => sum + Number(row.daysWorked || 0), 0);
    const ordersCompleted = list.reduce((sum, row) => sum + Number(row.ordersCompleted || 0), 0);
    const cancelled = list.reduce((sum, row) => sum + Number(row.cancelled || 0), 0);
    const totalPayDue = list.reduce((sum, row) => sum + Number(row.payDue || 0), 0);
    const totalMinutes = list.reduce((sum, row) => {
      const raw = row?.onlineTime || "0h 0m";
      const parts = raw.split(" ");
      const hrs = Number(parts[0]?.replace("h", "") || 0);
      const mins = Number(parts[1]?.replace("m", "") || 0);
      return sum + hrs * 60 + mins;
    }, 0);

    return {
      totalRunners,
      daysWorked,
      ordersCompleted,
      cancelled,
      onlineTime: formatMinutes(totalMinutes),
      totalPayDue,
    };
  }, [rows]);

  const dailyBreakdown = useMemo(() => {
    if (!selectedRunner) return [];
    const entries = checkins?.[selectedRunner.runnerId] || {};
    const days = {};
    Object.values(entries).forEach((entry) => {
      const at = entry?.checkinAt || entry?.startAt || 0;
      if (!at || at < startMs || at > endMs) return;
      const key = formatDate(at);
      if (!days[key]) {
        days[key] = { date: key, worked: "Yes", minutes: 0, sessions: 0 };
      }
      days[key].sessions += 1;
      const minutes = Number(entry?.minutes || 0);
      days[key].minutes += minutes;
    });

    const runnerOrders = ordersByRunner.delivered?.[selectedRunner.runnerId] || [];
    const runnerCancelled = ordersByRunner.cancelled?.[selectedRunner.runnerId] || [];
    const ordersByDate = {};
    const cancelledByDate = {};
    runnerOrders.forEach((order) => {
      const at =
        order?.statusTimestamps?.delivered ||
        order?.deliveredAt ||
        order?.updatedAt ||
        0;
      const key = formatDate(at);
      ordersByDate[key] = (ordersByDate[key] || 0) + 1;
    });
    runnerCancelled.forEach((order) => {
      const at =
        order?.statusTimestamps?.cancelled ||
        order?.cancelledAt ||
        order?.updatedAt ||
        0;
      const key = formatDate(at);
      cancelledByDate[key] = (cancelledByDate[key] || 0) + 1;
    });

    return Object.values(days)
      .map((item) => ({
        date: item.date,
        worked: item.sessions > 0 ? "Yes" : "No",
        onlineTime: formatMinutes(item.minutes),
        sessions: item.sessions,
        orders: ordersByDate[item.date] || 0,
        cancelled: cancelledByDate[item.date] || 0,
        activeTime: "-",
        notes: "",
        locked: selectedRunner.payrollStatus === "Locked",
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 14);
  }, [checkins, selectedRunner, ordersByRunner, startMs, endMs]);

  useEffect(() => {
    if (!selectedDay && dailyBreakdown.length) {
      setSelectedDay(dailyBreakdown[0].date);
    }
  }, [dailyBreakdown, selectedDay]);

  const sessionLog = useMemo(() => {
    if (!selectedRunner) return [];
    const entries = checkins?.[selectedRunner.runnerId] || {};
    const list = Object.values(entries)
      .map((entry) => ({
        startAt: entry?.startAt || entry?.checkinAt || 0,
        endAt: entry?.endAt || 0,
        minutes: Number(entry?.minutes || 0),
      }))
      .filter((entry) => {
        if (!entry.startAt) return false;
        if (entry.startAt < startMs || entry.startAt > endMs) return false;
        if (!selectedDay) return true;
        return formatDate(entry.startAt) === selectedDay;
      })
      .sort((a, b) => b.startAt - a.startAt)
      .slice(0, 6);

    return list.map((entry) => ({
      start: new Date(entry.startAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      end: entry.endAt
        ? new Date(entry.endAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
        : "-",
      duration: entry.minutes ? formatMinutes(entry.minutes) : "-",
    }));
  }, [checkins, selectedRunner, startMs, endMs, selectedDay]);

  const ordersForSelectedDay = useMemo(() => {
    if (!selectedRunner || !selectedDay) return [];
    const runnerOrders = ordersByRunner.delivered?.[selectedRunner.runnerId] || [];
    return runnerOrders.filter((order) => {
      const at =
        order?.statusTimestamps?.delivered ||
        order?.deliveredAt ||
        order?.updatedAt ||
        0;
      return formatDate(at) === selectedDay;
    });
  }, [ordersByRunner, selectedRunner, selectedDay]);

  const safeDailyBreakdown = Array.isArray(dailyBreakdown) ? dailyBreakdown : [];
  const safeSessionLog = Array.isArray(sessionLog) ? sessionLog : [];
  const safeOrdersForDay = Array.isArray(ordersForSelectedDay) ? ordersForSelectedDay : [];

  const onExportCsv = () => {
    const headers = [
      "Runner",
      "Runner ID",
      "Type",
      "Days Worked",
      "Online Time",
      "Orders Completed",
      "Cancelled",
      "Avg Orders/Day",
      "Last Seen",
      "Payroll Status",
    ];
    const csvRows = [headers.join(",")];
    safeRows.forEach((row) => {
      csvRows.push(
        [
          row.runnerName,
          row.runnerId,
          row.runnerType,
          row.daysWorked,
          row.onlineTime,
          row.ordersCompleted,
          row.cancelled,
          row.avgOrders,
          formatDateTime(row.lastSeen),
          row.payrollStatus,
        ]
          .map((val) => `"${String(val).replace(/\"/g, '""')}"`)
          .join(",")
      );
    });

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `runner-attendance-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const onExportPdf = () => {
    const html = `
      <html>
        <head>
          <title>Runner Attendance</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111; padding: 20px; }
            h1 { margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
            th { background: #f3f4f6; text-align: left; }
          </style>
        </head>
        <body>
          <h1>Runner Attendance</h1>
          <div>${rangeLabel}</div>
          <table>
            <thead>
              <tr>
                <th>Runner</th>
                <th>Runner ID</th>
                <th>Type</th>
                <th>Days Worked</th>
                <th>Online Time</th>
                <th>Orders Completed</th>
                <th>Cancelled</th>
                <th>Avg Orders/Day</th>
                <th>Last Seen</th>
                <th>Payroll Status</th>
              </tr>
            </thead>
            <tbody>
              ${safeRows
                .map(
                  (row) => `
                <tr>
                  <td>${row.runnerName}</td>
                  <td>${row.runnerId}</td>
                  <td>${row.runnerType}</td>
                  <td>${row.daysWorked}</td>
                  <td>${row.onlineTime}</td>
                  <td>${row.ordersCompleted}</td>
                  <td>${row.cancelled}</td>
                  <td>${row.avgOrders}</td>
                  <td>${formatDateTime(row.lastSeen)}</td>
                  <td>${row.payrollStatus}</td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const columns = [
    {
      key: "runnerName",
      label: "Runner",
      render: (val, row) => (
        <div className="admin-attendance-runner">
          <img
            className="admin-attendance-avatar"
            src={pickAvatar(row.runnerId, row.runnerName)}
            alt={row.runnerName}
          />
          <div>
            <div className="admin-attendance-name">{val}</div>
            <div className="admin-attendance-sub">#{row.runnerId}</div>
          </div>
        </div>
      ),
    },
    {
      key: "availability",
      label: "Status",
      render: (val) => (
        <span className={`admin-payroll ${val === "online" ? "isOpen" : "isLocked"}`}>
          {val === "online" ? "Online" : "Offline"}
        </span>
      ),
    },
    {
      key: "runnerStatus",
      label: "Account",
      render: (val) => {
        const status = String(val || "").toLowerCase();
        const labelMap = {
          active: "Active",
          inactive: "Inactive",
          suspended: "Suspended",
          pending: "Pending",
          banned: "Banned",
        };
        const label = labelMap[status] || "Unknown";
        const tone =
          status === "active"
            ? "isOpen"
            : status === "pending"
            ? "isWarning"
            : status === "inactive"
            ? "isInactive"
            : status === "suspended"
            ? "isSuspended"
            : status === "banned"
            ? "isBanned"
            : "isLocked";
        return <span className={`admin-payroll ${tone}`}>{label}</span>;
      },
    },
    { key: "daysWorked", label: "Days Worked" },
    { key: "onlineTime", label: "Online Time" },
    { key: "ordersCompleted", label: "Orders Completed" },
    { key: "cancelled", label: "Cancelled" },
    { key: "avgOrders", label: "Avg Orders/Day" },
    { key: "payDue", label: "Pay Due", render: (val) => money(val) },
    { key: "lastSeen", label: "Last Seen", render: (val) => formatDateTime(val) },
    {
      key: "payrollStatus",
      label: "Payroll Status",
      render: (val) => (
        <span className={`admin-payroll ${val === "Locked" ? "isLocked" : "isOpen"}`}>
          {val}
        </span>
      ),
    },
  ];

  return (
    <div className="admin-attendance">
      <div className="admin-attendance-header">
        <div>
          <h2 className="admin-attendance-title">Runner Attendance</h2>
          <p className="admin-attendance-sub">Monitor runner work activity and payroll status.</p>
        </div>
        <div className="admin-attendance-actions">
          <button className="admin-attendance-btn" onClick={onExportCsv}>Export CSV</button>
          <button className="admin-attendance-btn" onClick={onExportPdf}>Export PDF</button>
        </div>
      </div>

      <div className="admin-attendance-filters">
        <div className="admin-attendance-pill">
          <select
            className="admin-attendance-select"
            value={rangePreset}
            onChange={(e) => setRangePreset(e.target.value)}
          >
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
            <option value="custom">Custom range</option>
          </select>
          <div className="admin-attendance-range">{rangeLabel}</div>
        </div>
        {rangePreset === "custom" && (
          <div className="admin-attendance-pill">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </div>
        )}
        <div className="admin-attendance-pill">
          <select
            className="admin-attendance-select"
            value={runnerType}
            onChange={(e) => setRunnerType(e.target.value)}
          >
            <option value="all">Runner Type: All</option>
            <option value="goCrave">GoCrave</option>
            <option value="independent">Independent</option>
            <option value="company">Company</option>
          </select>
        </div>
        <div className="admin-attendance-pill">
          <select
            className="admin-attendance-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="active">Status: Active</option>
            <option value="inactive">Status: Inactive</option>
            <option value="all">Status: All</option>
          </select>
        </div>
        <div className="admin-attendance-search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Runner"
            aria-label="Search Runner"
          />
        </div>
      </div>

      <div className="admin-attendance-metrics">
        <div className="admin-attendance-metric isPrimary">
          <div className="admin-attendance-metric-label">Total Runners</div>
          <div className="admin-attendance-metric-value">{summary.totalRunners}</div>
        </div>
        <div className="admin-attendance-metric isWarning">
          <div className="admin-attendance-metric-label">Days Worked</div>
          <div className="admin-attendance-metric-value">{summary.daysWorked} Days</div>
        </div>
        <div className="admin-attendance-metric isSuccess">
          <div className="admin-attendance-metric-label">Total Online Time</div>
          <div className="admin-attendance-metric-value">{summary.onlineTime}</div>
        </div>
        <div className="admin-attendance-metric isInfo">
          <div className="admin-attendance-metric-label">Orders Completed</div>
          <div className="admin-attendance-metric-value">{summary.ordersCompleted}</div>
        </div>
        <div className="admin-attendance-metric isDanger">
          <div className="admin-attendance-metric-label">Cancelled</div>
          <div className="admin-attendance-metric-value">{summary.cancelled}</div>
        </div>
        <div className="admin-attendance-metric isPrimary">
          <div className="admin-attendance-metric-label">Total Pay Due</div>
          <div className="admin-attendance-metric-value">{money(summary.totalPayDue)}</div>
        </div>
      </div>

      <div className="admin-card" style={{ gridColumn: "1 / -1" }}>
        <div className="admin-card-header">
          <div>
            <h3 className="admin-card-title">Runner Attendance</h3>
            <p className="admin-card-sub">Attendance for the selected pay period.</p>
          </div>
        </div>

        <AdminDataTable
          columns={columns}
          data={safeRows.map((row) => ({
            ...row,
            actions: [
              {
                label: "View",
                onClick: () => setSelectedRunnerId(row.runnerId),
              },
            ],
          }))}
          emptyMessage="No check-ins yet."
        />
      </div>

      {selectedRunner && (
        <div className="admin-attendance-details">
          <div className="admin-attendance-details-header">
            Runner Attendance Details - {selectedRunner.runnerName} #{selectedRunner.runnerId}
          </div>

          <div className="admin-attendance-details-metrics">
            <div className="admin-attendance-detail-card">
              <div className="admin-attendance-detail-value">{selectedRunner.daysWorked}</div>
              <div className="admin-attendance-detail-label">Days Worked</div>
            </div>
            <div className="admin-attendance-detail-card">
              <div className="admin-attendance-detail-value">{selectedRunner.onlineTime}</div>
              <div className="admin-attendance-detail-label">Online Time</div>
            </div>
            <div className="admin-attendance-detail-card">
              <div className="admin-attendance-detail-value">{selectedRunner.ordersCompleted}</div>
              <div className="admin-attendance-detail-label">Orders Completed</div>
            </div>
            <div className="admin-attendance-detail-card isSuccess">
              <div className="admin-attendance-detail-value">{money(selectedRunner.payDue)}</div>
              <div className="admin-attendance-detail-label">Pay Due</div>
            </div>
            <div className="admin-attendance-detail-card isSuccess">
              <div className="admin-attendance-detail-value">
                JMD {Number(metrics?.[selectedRunner.runnerId]?.totalEarnings || 0).toLocaleString()}
              </div>
              <div className="admin-attendance-detail-label">Earnings</div>
            </div>
          </div>

          <div className="admin-attendance-daily">
            <div className="admin-attendance-daily-title">Daily Attendance Breakdown</div>
            <div className="admin-attendance-daily-table">
              {safeDailyBreakdown.length === 0 ? (
                <div className="admin-attendance-empty">No daily records yet.</div>
              ) : (
                safeDailyBreakdown.map((row, idx) => (
                  <button
                    type="button"
                    key={`${row.date}-${idx}`}
                    className={`admin-attendance-daily-row${selectedDay === row.date ? " isActive" : ""}`}
                    onClick={() => setSelectedDay(row.date)}
                  >
                    <div>{row.date}</div>
                    <div>{row.worked}</div>
                    <div>{row.onlineTime}</div>
                    <div>{row.sessions}</div>
                    <div>{row.orders}</div>
                    <div>{row.cancelled}</div>
                    <div>{row.activeTime}</div>
                    <div>{row.notes || "-"}</div>
                    <div>{row.locked ? "Locked" : "Open"}</div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="admin-attendance-split">
            <div className="admin-attendance-panel">
              <div className="admin-attendance-panel-title">Session Log</div>
              {safeSessionLog.length === 0 ? (
                <div className="admin-attendance-empty">No sessions logged.</div>
              ) : (
                safeSessionLog.map((item, idx) => (
                  <div key={`${item.start}-${idx}`} className="admin-attendance-session">
                    <div>{item.start} - {item.end}</div>
                    <div>{item.duration}</div>
                  </div>
                ))
              )}
            </div>

            <div className="admin-attendance-panel">
              <div className="admin-attendance-panel-title">Orders Fulfilled</div>
              {safeOrdersForDay.length === 0 ? (
                <div className="admin-attendance-empty">No orders listed.</div>
              ) : (
                safeOrdersForDay.map((order) => (
                  <div key={order.orderId} className="admin-attendance-session">
                    <div>#{order.orderId}</div>
                    <div>Delivered</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
