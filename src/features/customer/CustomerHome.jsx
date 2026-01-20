import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import { useUiStore } from "../../store/useUiStore";
import { listenMenus, listenRestaurants } from "../../services/restaurants.service";
import { listenPromotions } from "../../services/promotions.service";
import brandFallback from "../../assets/logo.png";

const money = (n) =>
  new Intl.NumberFormat("en-JM", { style: "currency", currency: "JMD" }).format(n);

export default function CustomerHome() {
  const profile = useAuthStore((s) => s.profile);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [quickPrice, setQuickPrice] = useState("");
  const [sortBy, setSortBy] = useState("recommended");
  const showFilters = useUiStore((s) => s.filtersOpen.home);
  const setFiltersOpen = useUiStore((s) => s.setFiltersOpen);

  const [restaurants, setRestaurants] = useState([]);
  const [menus, setMenus] = useState({});
  const [promotions, setPromotions] = useState([]);

  useEffect(() => {
    const unsub = listenRestaurants((list) => setRestaurants(list));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = listenMenus((data) => setMenus(data));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = listenPromotions((list) => setPromotions(list));
    return () => unsub();
  }, []);

  const activePromotions = useMemo(() => {
    const now = Date.now();
    return (promotions || []).filter((promo) => {
      if (promo.isActive === false) return false;
      if (promo.startsAt && promo.startsAt > now) return false;
      if (promo.endsAt && promo.endsAt < now) return false;
      return true;
    });
  }, [promotions]);

  const allMeals = useMemo(() => {
    const cards = [];
    restaurants.forEach((r) => {
      const restaurantMenus = menus?.[r.id]?.categories || {};
      Object.values(restaurantMenus).forEach((cat) => {
        const items = Object.values(cat.items || {});
        items.forEach((m) => {
          if (m.isAvailable === false) return;
          cards.push({
            id: m.id,
            name: m.name,
            price: m.price,
            thumb: m.thumb || r.thumb,
            restaurantName: r.name,
            restaurantId: r.id,
            category: cat.name || "Menu",
          });
        });
      });
    });
    return cards;
  }, [menus, restaurants]);

  const featuredMeals = useMemo(() => {
    const cards = [];
    restaurants.forEach((r) => {
      const restaurantMenus = menus?.[r.id]?.categories || {};
      Object.values(restaurantMenus).forEach((cat) => {
        const items = Object.values(cat.items || {}).slice(0, 4);
        items.forEach((m) => {
          if (m.isAvailable === false) return;
          cards.push({
            id: m.id,
            name: m.name,
            price: m.price,
            thumb: m.thumb || r.thumb,
            restaurantName: r.name,
            restaurantId: r.id,
            category: cat.name || "Menu",
          });
        });
      });
    });
    return cards.slice(0, 12);
  }, [menus, restaurants]);

  const categories = useMemo(() => {
    const set = new Set();
    allMeals.forEach((item) => set.add(item.category || "Menu"));
    return Array.from(set);
  }, [allMeals]);

  const toggleCategory = (category) => {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((c) => c !== category)
        : [...current, category]
    );
  };

  const applyQuickPrice = (label, min, max) => {
    setQuickPrice(label);
    setMinPrice(min ? String(min) : "");
    setMaxPrice(max ? String(max) : "");
  };

  const filteredMeals = useMemo(() => {
    const min = minPrice ? Number(minPrice) : null;
    const max = maxPrice ? Number(maxPrice) : null;
    const q = query.trim().toLowerCase();

    const list = allMeals.filter((m) => {
      if (selectedCategories.length && !selectedCategories.includes(m.category)) {
        return false;
      }
      if (q && !m.name.toLowerCase().includes(q) && !m.restaurantName.toLowerCase().includes(q)) {
        return false;
      }
      if (min !== null && m.price < min) return false;
      if (max !== null && m.price > max) return false;
      return true;
    });

    switch (sortBy) {
      case "price_low":
        return [...list].sort((a, b) => a.price - b.price);
      case "price_high":
        return [...list].sort((a, b) => b.price - a.price);
      case "popular":
        return list;
      case "newest":
        return list;
      default:
        return list;
    }
  }, [allMeals, maxPrice, minPrice, query, selectedCategories, sortBy]);

  const hasFilters =
    query.trim() ||
    selectedCategories.length > 0 ||
    minPrice ||
    maxPrice ||
    quickPrice ||
    sortBy !== "recommended";

  const displayMeals = hasFilters ? filteredMeals : featuredMeals;

  return (
    <div className="gc-page" style={{ padding: 18 }}>
      <div className="gc-homeTop">
        <div>
          <div className="gc-pill">Workplace delivery</div>
          <h2 className="gc-pageTitle">
            Hey {profile?.name?.split(" ")[0] || "there"}!
          </h2>
          <p className="gc-muted">Order in seconds. Your runner brings it to the lobby.</p>
        </div>

        <button className="gc-miniBtn" onClick={() => navigate("/customer/restaurants")}>
          Browse restaurants
        </button>
      </div>

      <div className="gc-search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search restaurants or meals"
        />
        <button
          className="gc-filterToggle"
          type="button"
          onClick={() => setFiltersOpen("home", !showFilters)}
          aria-expanded={showFilters}
        >
          {showFilters ? "Hide filters" : "Filters"}
        </button>
      </div>

      {activePromotions.length > 0 && (
        <div className="gc-section">
          <div className="gc-sectionTitleRow">
            <h3 className="gc-sectionTitle">Promotions</h3>
          </div>

          <div className="gc-hScroll">
            {activePromotions.map((promo) => (
              <div key={promo.promoId} className="gc-promoCard">
                <div className="gc-promoTop">
                  {promo.badge ? <span className="gc-promoBadge">{promo.badge}</span> : null}
                  {promo.imageUrl ? (
                    <img className="gc-promoImg" src={promo.imageUrl} alt={promo.title} />
                  ) : null}
                </div>
                <div className="gc-promoBody">
                  <div className="gc-promoTitle">{promo.title}</div>
                  <div className="gc-promoSub">{promo.subtitle}</div>
                  {promo.ctaText ? (
                    <button
                      className="gc-miniBtn brand"
                      onClick={() => {
                        if (promo.ctaLink) {
                          window.open(promo.ctaLink, "_blank");
                        } else {
                          navigate("/customer/restaurants");
                        }
                      }}
                    >
                      {promo.ctaText}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showFilters && (
        <div className="gc-filterPanel" style={{ marginTop: 12 }}>
          <div className="gc-filterBar">
            <div className="gc-filterTitle">Sort</div>
            <select
              className="gc-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="recommended">Recommended</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
              <option value="popular">Most popular</option>
              <option value="newest">Newest</option>
            </select>
          </div>

          <div>
            <div className="gc-filterTitle">Category</div>
            <div className="gc-filterChips">
              {categories.length === 0 ? (
                <span className="gc-muted" style={{ fontSize: 12 }}>
                  Add categories to see filters.
                </span>
              ) : (
                categories.map((cat) => (
                  <button
                    key={cat}
                    className={"gc-chip" + (selectedCategories.includes(cat) ? " isActive" : "")}
                    onClick={() => toggleCategory(cat)}
                  >
                    {cat}
                  </button>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="gc-filterTitle">Price range (JMD)</div>
            <div className="gc-filterRange">
              <input
                className="gc-input"
                placeholder="Min"
                inputMode="numeric"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
              />
              <input
                className="gc-input"
                placeholder="Max"
                inputMode="numeric"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </div>
            <div className="gc-filterChips">
              <button
                className={"gc-chip" + (quickPrice === "under_1000" ? " isActive" : "")}
                onClick={() => applyQuickPrice("under_1000", 0, 1000)}
              >
                Under 1000
              </button>
              <button
                className={"gc-chip" + (quickPrice === "1000_2000" ? " isActive" : "")}
                onClick={() => applyQuickPrice("1000_2000", 1000, 2000)}
              >
                1000-2000
              </button>
              <button
                className={"gc-chip" + (quickPrice === "2000_4000" ? " isActive" : "")}
                onClick={() => applyQuickPrice("2000_4000", 2000, 4000)}
              >
                2000-4000
              </button>
              <button
                className={"gc-chip" + (quickPrice === "4000_plus" ? " isActive" : "")}
                onClick={() => applyQuickPrice("4000_plus", 4000, null)}
              >
                4000+
              </button>
              <button className="gc-chip" onClick={() => applyQuickPrice("", null, null)}>
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="gc-section">
        <div className="gc-sectionTitleRow">
          <h3 className="gc-sectionTitle">Restaurants</h3>
          <span className="gc-linkSmall" onClick={() => navigate("/customer/restaurants")}>
            See all
          </span>
        </div>

        <div className="gc-hScroll">
          {restaurants.map((r) => (
            <button
              key={r.id}
              className="gc-restChip"
              onClick={() => navigate("/customer/restaurants")}
            >
              <img
                className="gc-restThumb"
                src={r.thumb || brandFallback}
                alt={r.name}
              />
              <div>
                <div className="gc-restName">{r.name}</div>
                <div className="gc-restMeta">ETA {r.eta || "—"}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="gc-section">
        <div className="gc-sectionTitleRow">
          <h3 className="gc-sectionTitle">Popular meals</h3>
          <span className="gc-linkSmall">Fresh picks</span>
        </div>

        <div className="gc-mealGrid">
          {displayMeals.map((m) => (
            <div key={m.id} className="gc-mealCard">
              <img className="gc-mealThumb" src={m.thumb || brandFallback} alt={m.name} />
              <div className="gc-mealInfo">
                <div className="gc-mealTitle">{m.name}</div>
                <div className="gc-mealSub">{m.restaurantName}</div>
                <div className="gc-mealPrice">{money(m.price)}</div>
              </div>
              <button className="gc-addBtn" onClick={() => navigate("/customer/restaurants")}>
                View menu
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
