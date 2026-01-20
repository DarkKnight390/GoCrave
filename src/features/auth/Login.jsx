import { useEffect, useState } from "react";
import { login, logout } from "../../services/auth.service";
import { getUserProfile } from "../../services/rtdb.service";
import { useAuthStore } from "../../store/useAuthStore";
import { Link, useNavigate } from "react-router-dom";
import logo from "../../assets/logo.png";
import bk from "../../assets/restaurants/burger-king.png";
import pizzaHut from "../../assets/restaurants/pizza-hut.png";
import kfc from "../../assets/restaurants/kfc.png";
import popeyes from "../../assets/restaurants/popeyes.png";
import subway from "../../assets/restaurants/subway.png";
import littlecaesars from "../../assets/restaurants/little-caesars.png";

export default function Login() {
  const [role, setRole] = useState("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loadingBtn, setLoadingBtn] = useState(false);

  const { profile, loading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && profile?.role) navigate(`/${profile.role}`);
  }, [loading, profile, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoadingBtn(true);
    try {
      const user = await login({ email, password });
      const profileData = await getUserProfile(user.uid);

      if (!profileData) {
        await logout();
        throw new Error("Profile not found. Contact GoCrave Admin.");
      }

      if (profileData.role !== role) {
        await logout();
        throw new Error(`This account is registered as ${profileData.role}.`);
      }
      // routing happens via auth listener + profile load
    } catch (error) {
      setErr(error?.message || "Login failed");
    } finally {
      setLoadingBtn(false);
    }
  };

  const pickNextIndex = (count, current) => {
    if (count <= 1) return 0;
    let next = current;
    while (next === current) next = Math.floor(Math.random() * count);
    return next;
  };

  const logos = [
    { src: kfc, alt: "KFC" },
    { src: pizzaHut, alt: "Pizza Hut" },
    { src: bk, alt: "Burger King" },
    { src: popeyes, alt: "Popeyes" },
    { src: subway, alt: "Subway" },
    { src: littlecaesars, alt: "Little Caesars" },
  ];

  // Two-slot crossfade system
  const [slotA, setSlotA] = useState(0);
  const [slotB, setSlotB] = useState(pickNextIndex(logos.length, 0));
  const [showA, setShowA] = useState(true);

  useEffect(() => {
    const HOLD_MS = 1900;
    const currentIndex = showA ? slotA : slotB;

    const t = setTimeout(() => {
      const nextIndex = pickNextIndex(logos.length, currentIndex);

      if (showA) {
        setSlotB(nextIndex);
        requestAnimationFrame(() => setShowA(false));
      } else {
        setSlotA(nextIndex);
        requestAnimationFrame(() => setShowA(true));
      }
    }, HOLD_MS);

    return () => clearTimeout(t);
  }, [showA, slotA, slotB]);

  return (
    <div className="gc-container">
      <div className="gc-card">
        {/* Left: Brand / Pitch */}
        <div className="gc-left">
          <div className="gc-topBrand">
            <div className="gc-logoWrap">
              <img
                className="gc-logoAnim"
                src={logo}
                alt="GoCrave Logo"
                style={{
                  width: 160,
                  height: "auto",
                  filter: "drop-shadow(0 14px 32px rgba(255,106,0,0.4))",
                }}
              />
            </div>

            <p className="gc-sub gc-centerText">
              Order lunch fast. Save your break. No more sun missions.
            </p>
          </div>

          <div className="gc-restaurants">
            <p className="gc-restaurantsTitle">Available restaurants</p>

            <div className="gc-logoStage">
              <img
                src={logos[slotA].src}
                alt={logos[slotA].alt}
                className={`gc-crossLogo ${showA ? "isActive" : ""}`}
              />
              <img
                src={logos[slotB].src}
                alt={logos[slotB].alt}
                className={`gc-crossLogo ${!showA ? "isActive" : ""}`}
              />
            </div>

            <p className="gc-restaurantsSub">More restaurants coming soon</p>
          </div>
        </div>
        {/* Right: Form */}
        <div className="gc-right">
          <h2 className="gc-formTitle">Welcome back</h2>
          <p className="gc-formSub">Log in to start craving responsibly.</p>

          <form onSubmit={onSubmit}>
            <div className="gc-field">
              <label className="gc-label">Login as</label>
              <div className="gc-roleGrid">
                <button
                  type="button"
                  className={`gc-roleOption ${role === "customer" ? "isActive" : ""}`}
                  onClick={() => setRole("customer")}
                >
                  <p className="gc-roleTitle">Customer</p>
                  <p className="gc-roleDesc">Place orders at work</p>
                </button>

                <button
                  type="button"
                  className={`gc-roleOption ${role === "runner" ? "isActive" : ""}`}
                  onClick={() => setRole("runner")}
                >
                  <p className="gc-roleTitle">Crave Runner</p>
                  <p className="gc-roleDesc">Deliver orders nearby</p>
                </button>

                <button
                  type="button"
                  className={`gc-roleOption ${role === "admin" ? "isActive" : ""}`}
                  onClick={() => setRole("admin")}
                >
                  <p className="gc-roleTitle">Admin</p>
                  <p className="gc-roleDesc">Manage GoCrave</p>
                </button>
              </div>
            </div>

            <div className="gc-field">
              <label className="gc-label">Email</label>
              <input
                className="gc-input"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="gc-field">
              <label className="gc-label">Password</label>
              <input
                className="gc-input"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="gc-row">
              <span>Secure login</span>
              <span className="gc-smallLink">Forgot password (soon)</span>
            </div>

            <button className="gc-btn" disabled={loadingBtn}>
              {loadingBtn ? "Logging in..." : "Login"}
            </button>

            {err && <p className="gc-error">{err}</p>}
          </form>

          <p className="gc-foot">
            New to GoCrave? <Link to="/signup">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
