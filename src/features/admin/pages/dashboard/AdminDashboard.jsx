import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminKPICard from "../../components/shared/AdminKPICard";
import AdminDataTable from "../../components/shared/AdminDataTable";
import AdminStatusBadge from "../../components/shared/AdminStatusBadge";
import { listenOrders } from "../../../../services/rtdb.service";
import { listenRunners, listenRunnersCoreAll } from "../../../../services/runners.service";
import { notifyPushTest } from "../../../../services/notifications.service";
import { useAuthStore } from "../../../../store/useAuthStore";

const money = (n) =>
  new Intl.NumberFormat("en-JM", { style: "currency", currency: "JMD" }).format(n || 0);

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [runners, setRunners] = useState([]);
  const [runnersCore, setRunnersCore] = useState({});
  const [loading, setLoading] = useState(true);
  const [pushStatus, setPushStatus] = useState("");
  const [pushBusy, setPushBusy] = useState(false);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    setLoading(true);
    const unsub1 = listenOrders((list) => {
      setOrders(list);
      setLoading(false);
    });
    const unsub2 = listenRunners((list) => setRunners(list));
    const unsub3 = listenRunnersCoreAll((val) => setRunnersCore(val));
    return () => {
      unsub1?.();
      unsub2?.();
      unsub3?.();
    };
  }, []);

  const metrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = orders.filter((o) => {
      const orderDate = new Date(o.createdAt);
      orderDate.setHours(0, 0, 0, 0);
      return orderDate.getTime() === today.getTime();
    });

    const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.pricing?.total || 0), 0);
    const allTimeRevenue = orders.reduce((sum, o) => sum + (o.pricing?.total || 0), 0);

    const coreList = Object.values(runnersCore || {}).filter(
      (r) => r && typeof r === "object" && r.runnerId
    );
    const availabilityById = {};
    const statusById = {};
    const ratingValues = [];

    coreList.forEach((runner) => {
      availabilityById[runner.runnerId] = runner.availability;
      statusById[runner.runnerId] = runner.status || "active";
      if (runner.ratingAvg !== undefined) ratingValues.push(Number(runner.ratingAvg || 0));
    });

    runners.forEach((runner) => {
      if (!runner?.runnerId) return;
      if (!availabilityById[runner.runnerId]) {
        availabilityById[runner.runnerId] = runner.availability;
      }
      if (!statusById[runner.runnerId]) {
        statusById[runner.runnerId] = runner.status || "active";
      }
      if (runner.ratingAvg !== undefined) ratingValues.push(Number(runner.ratingAvg || 0));
    });

    const runnerIds = new Set([
      ...Object.keys(availabilityById),
      ...Object.keys(statusById),
    ]);

    const onlineRunners = Array.from(runnerIds).filter(
      (id) => availabilityById[id] === "online"
    ).length;
    const totalRunners = Array.from(runnerIds).filter(
      (id) => statusById[id] === "active"
    ).length;

    const avgRating =
      ratingValues.length > 0
        ? (ratingValues.reduce((sum, val) => sum + val, 0) / ratingValues.length).toFixed(1)
        : "0.0";

    return {
      todayOrders: todayOrders.length,
      todayRevenue,
      onlineRunners,
      totalRunners,
      avgRating,
      allTimeRevenue,
    };
  }, [orders, runnersCore]);

  const recentOrders = useMemo(() => {
    return orders
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 10)
      .map((order) => {
        const runner = runners.find(
          (r) => r.authUid === order.runnerId || r.runnerId === order.runnerId
        );
        return {
          ...order,
          runnerName: runner?.name || "Unassigned",
          customerName: order?.delivery?.name || order?.customerName || "Customer",
          statusBadge: order.status,
        };
      });
  }, [orders, runners]);

  const columns = [
    {
      key: "orderId",
      label: "Order ID",
      sortable: true,
      render: (value) => `#${String(value).slice(-6)}`,
    },
    {
      key: "customerName",
      label: "Customer",
      sortable: true,
      render: (value) => value || "Customer",
    },
    {
      key: "restaurantName",
      label: "Restaurant",
      sortable: false,
      render: (value) => value || "Restaurant",
    },
    {
      key: "runnerName",
      label: "Runner",
      sortable: false,
    },
    {
      key: "statusBadge",
      label: "Status",
      sortable: true,
      render: (value) => <AdminStatusBadge status={value} />,
    },
    {
      key: "pricing",
      label: "Amount",
      sortable: true,
      render: (value) => money(value?.total || 0),
    },
  ];

  return (
    <div className="admin-dashboard">
      {/* KPI Cards */}
      <AdminKPICard
        title="Today's Orders"
        value={metrics.todayOrders}
        change={5}
        icon="ORD"
        period="today"
        onClick={() => navigate("/admin/orders")}
      />

      <AdminKPICard
        title="Today's Revenue"
        value={money(metrics.todayRevenue)}
        change={8}
        icon="JMD"
        period="today"
        onClick={() => navigate("/admin/orders")}
      />

      <AdminKPICard
        title="Online Runners"
        value={`${metrics.onlineRunners}/${metrics.totalRunners}`}
        change={null}
        icon="RUN"
        period="now"
        onClick={() => navigate("/admin/runners")}
      />

      <AdminKPICard
        title="Avg Rating"
        value={`${metrics.avgRating}`}
        change={2}
        icon="AVG"
        period="all time"
      />

      {/* Quick Actions */}
      <div className="admin-card" style={{ gridColumn: "1 / -1" }}>
        <div className="admin-card-header">
          <div>
            <h3 className="admin-card-title">Quick Actions</h3>
            <p className="admin-card-sub">Commonly used admin functions</p>
          </div>
        </div>
        <div className="admin-quick-actions">
          <button className="admin-primary" onClick={() => navigate("/admin/orders")}>
            Manage Orders
          </button>
          <button className="admin-primary" onClick={() => navigate("/admin/runners")}>
            Manage Runners
          </button>
          <button className="admin-primary" onClick={() => navigate("/admin/restaurants")}>
            Manage Restaurants
          </button>
          <button className="admin-primary" onClick={() => navigate("/admin/messages")}>
            View Support Messages
          </button>
          <button
            className="admin-primary"
            onClick={async () => {
              if (!user?.uid || pushBusy) return;
              setPushBusy(true);
              setPushStatus("");
              try {
                await notifyPushTest(user.uid);
                setPushStatus("Test push sent.");
              } catch (err) {
                setPushStatus(err?.message || "Failed to send push.");
              } finally {
                setPushBusy(false);
              }
            }}
            disabled={!user?.uid || pushBusy}
          >
            {pushBusy ? "Sending..." : "Send Test Push"}
          </button>
        </div>
        {pushStatus ? <div className="admin-card-sub">{pushStatus}</div> : null}
      </div>

      {/* Recent Orders */}
      <div className="admin-card" style={{ gridColumn: "1 / -1" }}>
        <div className="admin-card-header">
          <div>
            <h3 className="admin-card-title">Recent Orders</h3>
            <p className="admin-card-sub">Last 10 orders</p>
          </div>
          <button className="admin-primary" onClick={() => navigate("/admin/orders")}>
            View All
          </button>
        </div>
        <AdminDataTable
          columns={columns}
          data={recentOrders}
          loading={loading}
          emptyMessage="No orders yet"
        />
      </div>
    </div>
  );
}
