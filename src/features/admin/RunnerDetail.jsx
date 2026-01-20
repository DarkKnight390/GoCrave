import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { addPayment, listenRunners, listenSubscriptions } from "../../services/runners.service";

const money = (n) =>
  new Intl.NumberFormat("en-JM", { style: "currency", currency: "JMD" }).format(n);

export default function RunnerDetail() {
  const { runnerId } = useParams();
  const navigate = useNavigate();
  const [runners, setRunners] = useState([]);
  const [subscriptions, setSubscriptions] = useState({});
  const [paymentAmount, setPaymentAmount] = useState("5000");
  const [paymentDate, setPaymentDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  useEffect(() => {
    const unsub = listenRunners((list) => setRunners(list));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = listenSubscriptions((data) => setSubscriptions(data));
    return () => unsub();
  }, []);

  const runner = useMemo(
    () => runners.find((r) => r.runnerId === runnerId),
    [runners, runnerId]
  );

  const subscription = runner ? subscriptions[runner.runnerId] : null;
  const payments = subscription?.payments ? Object.values(subscription.payments) : [];

  return (
    <div className="gc-page" style={{ padding: 18 }}>
      <div className="gc-homeTop">
        <div>
          <div className="gc-pill">Runner</div>
          <h2 className="gc-pageTitle">{runner ? runner.name : "Runner"}</h2>
          {runner && (
            <p className="gc-muted">
              {runner.runnerId} - {runner.runnerType} - {runner.status || "active"}
            </p>
          )}
        </div>
        <button className="gc-miniBtn" onClick={() => navigate(-1)}>
          Back
        </button>
      </div>

      {!runner ? (
        <div className="gc-infoCard">Runner not found.</div>
      ) : (
        <>
          <div className="gc-restGrid">
            <div className="gc-panel">
              <h3 className="gc-panelTitle">Details</h3>
              <div className="gc-infoRow">
                <span className="gc-infoKey">Phone</span>
                <span className="gc-infoVal">{runner.phone || "-"}</span>
              </div>
              <div className="gc-infoRow">
                <span className="gc-infoKey">Address</span>
                <span className="gc-infoVal">{runner.address || "-"}</span>
              </div>
              <div className="gc-infoRow">
                <span className="gc-infoKey">Login Email</span>
                <span className="gc-infoVal">{runner.loginEmail || "-"}</span>
              </div>
              <div className="gc-infoRow">
                <span className="gc-infoKey">TRN</span>
                <span className="gc-infoVal">{runner.trnMasked || "-"}</span>
              </div>
              <div className="gc-infoRow">
                <span className="gc-infoKey">ID</span>
                <span className="gc-infoVal">{runner.idType} - {runner.idMasked || "-"}</span>
              </div>
              <div className="gc-infoRow">
                <span className="gc-infoKey">Verification</span>
                <span className="gc-infoVal">{runner.verificationStatus || "pending"}</span>
              </div>
              <div className="gc-infoRow">
                <span className="gc-infoKey">Max active orders</span>
                <span className="gc-infoVal">{runner.maxActiveOrders ?? "-"}</span>
              </div>
              <div className="gc-infoRow">
                <span className="gc-infoKey">Max distance</span>
                <span className="gc-infoVal">
                  {runner.maxDeliveryDistanceKm ? `${runner.maxDeliveryDistanceKm} km` : "-"}
                </span>
              </div>
              <div className="gc-infoRow">
                <span className="gc-infoKey">Cash handling</span>
                <span className="gc-infoVal">
                  {runner.cashHandlingAllowed === false ? "No" : "Yes"}
                </span>
              </div>
              <div className="gc-infoRow">
                <span className="gc-infoKey">Daily cap</span>
                <span className="gc-infoVal">
                  {runner.dailyEarningsCap ? money(runner.dailyEarningsCap) : "-"}
                </span>
              </div>
            </div>

            <div className="gc-panel">
              <h3 className="gc-panelTitle">Subscription</h3>
              {runner.runnerType !== "independent" ? (
                <p className="gc-muted">GoCrave runners do not require subscriptions.</p>
              ) : subscription ? (
                <>
                  <div className="gc-infoRow">
                    <span className="gc-infoKey">Plan</span>
                    <span className="gc-infoVal">{subscription.plan}</span>
                  </div>
                  <div className="gc-infoRow">
                    <span className="gc-infoKey">Status</span>
                    <span className="gc-infoVal">{subscription.status}</span>
                  </div>
                  <div className="gc-infoRow">
                    <span className="gc-infoKey">Active Until</span>
                    <span className="gc-infoVal">
                      {subscription.activeUntil
                        ? new Date(subscription.activeUntil).toLocaleDateString()
                        : "-"}
                    </span>
                  </div>
                </>
              ) : (
                <p className="gc-muted">No subscription found.</p>
              )}
            </div>
          </div>

          <div className="gc-panel" style={{ marginTop: 16 }}>
            <h3 className="gc-panelTitle">Payment history</h3>
            {runner.runnerType !== "independent" ? (
              <p className="gc-muted">GoCrave runners do not require payments.</p>
            ) : payments.length === 0 ? (
              <p className="gc-muted">No payments recorded.</p>
            ) : (
              payments
                .sort((a, b) => b.paidAt - a.paidAt)
                .map((p) => (
                  <div key={p.paidAt} className="gc-infoRow">
                    <span className="gc-infoKey">
                      {new Date(p.paidAt).toLocaleDateString()}
                    </span>
                    <span className="gc-infoVal">{money(p.amountJMD || 0)}</span>
                  </div>
                ))
            )}

            {runner.runnerType === "independent" && (
              <div className="gc-adminPayment">
                <div className="gc-adminPaymentTitle">Add payment</div>
                <div className="gc-formGrid">
                  <input
                    className="gc-input"
                    placeholder="Amount (JMD)"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                  <input
                    className="gc-input"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>
                <button
                  className="gc-adminPrimary"
                  type="button"
                  onClick={() =>
                    addPayment(
                      runner.runnerId,
                      paymentAmount,
                      new Date(paymentDate).getTime(),
                      30
                    )
                  }
                >
                  Add payment
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
