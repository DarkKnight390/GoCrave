import { useEffect, useState } from "react";
import { signup } from "../../services/auth.service";
import { useAuthStore } from "../../store/useAuthStore";
import { Link, useNavigate } from "react-router-dom";
import logo from "../../assets/logo.png";

import bk from "../../assets/restaurants/burger-king.png";
import pizzaHut from "../../assets/restaurants/pizza-hut.png";
import kfc from "../../assets/restaurants/kfc.png";
import popeyes from "../../assets/restaurants/popeyes.png";
import subway from "../../assets/restaurants/subway.png";
import littlecaesars from "../../assets/restaurants/little-caesars.png";


const pickNextIndex = (count, current) => {
  if (count <= 1) return 0;
  let next = current;
  while (next === current) next = Math.floor(Math.random() * count);
  return next;
};

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [err, setErr] = useState("");
  const [loadingBtn, setLoadingBtn] = useState(false);

  const { profile, loading } = useAuthStore();
  const navigate = useNavigate();

  // Auto-route when profile loads
  useEffect(() => {
    if (!loading && profile?.role) navigate(`/${profile.role}`);
  }, [loading, profile, navigate]);

  // Restaurant crossfade (random, no repeats)
  const logos = [
    { src: kfc, alt: "KFC" },
      { src: pizzaHut, alt: "Pizza Hut" },
      { src: bk, alt: "Burger King" },
        { src: popeyes, alt: "Popeyes" },
        { src: subway, alt: "Subway" },
        { src: littlecaesars, alt: "Little Caesars" },
  ];

  const [slotA, setSlotA] = useState(0);
  const [slotB, setSlotB] = useState(pickNextIndex(logos.length, 0));
  const [showA, setShowA] = useState(true);

  useEffect(() => {
    const HOLD_MS = 1400;
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

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoadingBtn(true);
    try {
      await signup({ name, role: "customer", email, password });
      // routing happens via auth listener + profile load
    } catch (error) {
      setErr(error?.message || "Signup failed");
    } finally {
      setLoadingBtn(false);
    }
  };

  return (
    <div className="gc-container">
      <div className="gc-card gc-signup">
        {/* Left: Brand */}
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
                  filter: "drop-shadow(0 14px 32px rgba(255,106,0,0.35))",
                }}
              />
            </div>

            <p className="gc-sub gc-centerText">
              Create your account and start ordering without leaving the office.
            </p>
          </div>

          <div className="gc-restaurants">
            <p className="gc-restaurantsTitle">Popular picks</p>

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
          <h2 className="gc-formTitle">Create account</h2>
          <p className="gc-formSub">Create a customer account to start ordering.</p>
          <p className="gc-formSub">
            Crave Runner accounts are created by GoCrave Admin after onboarding.
          </p>

          <form onSubmit={onSubmit}>
            <div className="gc-field">
              <label className="gc-label">Full name</label>
              <input
                className="gc-input"
                placeholder="e.g. Damion Brown"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
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
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button className="gc-btn" disabled={loadingBtn}>
              {loadingBtn ? "Creating..." : "Create Account"}
            </button>

            {err && <p className="gc-error">{err}</p>}
          </form>

          <p className="gc-foot">
            Already have an account? <Link to="/">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
