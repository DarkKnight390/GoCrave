import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCartStore } from "../../store/useCartStore";
import { useUiStore } from "../../store/useUiStore";
import {
  listenCategoriesWithItems,
  listenRestaurants,
} from "../../services/restaurants.service";
import brandFallback from "../../assets/logo.png";

const money = (n) =>
  new Intl.NumberFormat("en-JM", { style: "currency", currency: "JMD" }).format(n);

export default function CustomerRestaurants() {
  const navigate = useNavigate();
  const addItem = useCartStore((s) => s.addItem);
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal);
  const incItem = useCartStore((s) => s.inc);
  const decItem = useCartStore((s) => s.dec);
  const removeItem = useCartStore((s) => s.removeItem);

  const [restaurants, setRestaurants] = useState([]);
  const [active, setActive] = useState(null);
  const [categories, setCategories] = useState([]);
  const [warnOpen, setWarnOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [quickPrice, setQuickPrice] = useState("");
  const [sortBy, setSortBy] = useState("recommended");
  const [optionModalItem, setOptionModalItem] = useState(null);
  const [optionSelections, setOptionSelections] = useState({});
  const [optionError, setOptionError] = useState("");
  const showFilters = useUiStore((s) => s.filtersOpen.restaurants);
  const setFiltersOpen = useUiStore((s) => s.setFiltersOpen);

  useEffect(() => {
    const unsub = listenRestaurants((list) => {
      setRestaurants(list);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!active?.id && restaurants.length) {
      setActive(restaurants[0]);
      return;
    }
    if (active && !restaurants.find((r) => r.id === active.id)) {
      setActive(restaurants[0] || null);
    }
  }, [active, restaurants]);

  useEffect(() => {
    if (!active?.id) {
      setCategories([]);
      return undefined;
    }
    setSelectedCategories([]);
    const unsub = listenCategoriesWithItems(active.id, (list) => {
      setCategories(list);
    });
    return () => unsub();
  }, [active?.id]);

  const categoryNames = useMemo(() => categories.map((c) => c.name), [categories]);

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

  const filteredMenu = useMemo(() => {
    const min = minPrice ? Number(minPrice) : null;
    const max = maxPrice ? Number(maxPrice) : null;
    const q = query.trim().toLowerCase();

    const menuItems = categories
      .flatMap((cat) => cat.items)
      .filter((item) => item.isAvailable !== false);
    const list = menuItems.filter((item) => {
      if (selectedCategories.length && !selectedCategories.includes(item.category)) {
        return false;
      }
      if (q && !item.name.toLowerCase().includes(q)) {
        return false;
      }
      if (min !== null && item.price < min) return false;
      if (max !== null && item.price > max) return false;
      return true;
    });

    switch (sortBy) {
      case "price_low":
        return [...list].sort((a, b) => a.price - b.price);
      case "price_high":
        return [...list].sort((a, b) => b.price - a.price);
      case "newest":
        return list;
      case "popular":
        return list;
      default:
        return list;
    }
  }, [categories, maxPrice, minPrice, query, selectedCategories, sortBy]);

  const groupedFilteredMenu = useMemo(() => {
    if (sortBy === "price_low" || sortBy === "price_high") {
      return [["Menu", filteredMenu]];
    }
    const groups = new Map();
    filteredMenu.forEach((item) => {
      const key = item.category || "Menu";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    return Array.from(groups.entries());
  }, [filteredMenu, sortBy]);

  const normalizeGroups = (item) =>
    (item?.options || []).map((group, idx) => ({
      id: group.id || `grp_${idx}`,
      name: group.name || "Options",
      type: group.type === "multi" ? "multi" : "single",
      required: group.required !== false,
      choices: (group.choices || []).map((choice, cIdx) => ({
        id: choice.id || `opt_${cIdx}`,
        label: choice.label || "Option",
        price: Number(choice.price || 0),
      })),
    }));

  const buildOptionsKey = (selections) => {
    const parts = Object.keys(selections)
      .sort()
      .map((groupId) => {
        const choiceIds = selections[groupId] || [];
        return `${groupId}:${choiceIds.slice().sort().join(" ? ")}`;
      });
    return parts.join(" ? ");
  };

  const onAdd = (item) => {
    if (!active) return null;
    const groups = normalizeGroups(item);
    if (groups.length) {
      setOptionModalItem({ ...item, optionGroups: groups });
      setOptionSelections({});
      setOptionError("");
      return null;
    }

    const ok = addItem({ id: active.id, name: active.name }, item);
    if (ok === false) {
      setWarnOpen(true);
    }
    return ok;
  };

  const selectOption = (groupId, choiceId, type) => {
    setOptionSelections((prev) => {
      const next = { ...prev };
      if (type === "multi") {
        const current = new Set(next[groupId] || []);
        if (current.has(choiceId)) current.delete(choiceId);
        else current.add(choiceId);
        next[groupId] = Array.from(current);
      } else {
        next[groupId] = [choiceId];
      }
      return next;
    });
  };

  const confirmOptions = () => {
    if (!optionModalItem) return;
    const groups = optionModalItem.optionGroups || [];
    const missing = groups.find(
      (group) => group.required && !(optionSelections[group.id] || []).length
    );
    if (missing) {
      setOptionError(`Select at least one option for "${missing.name}".`);
      return;
    }

    const selectedOptions = groups
      .map((group) => {
        const picks = optionSelections[group.id] || [];
        const choices = group.choices.filter((c) => picks.includes(c.id));
        return {
          groupId: group.id,
          groupName: group.name,
          type: group.type,
          choices,
        };
      })
      .filter((group) => group.choices.length);

    const optionsTotal = selectedOptions.reduce(
      (sum, group) =>
        sum + group.choices.reduce((groupSum, c) => groupSum + Number(c.price || 0), 0),
      0
    );
    const optionsKey = buildOptionsKey(optionSelections);
    const cartId = `${optionModalItem.id}-${optionsKey || "base"}`;
    const cartItem = {
      ...optionModalItem,
      cartId,
      basePrice: Number(optionModalItem.price || 0),
      options: selectedOptions,
      optionsTotal,
      price: Number(optionModalItem.price || 0) + optionsTotal,
    };

    const ok = addItem({ id: active.id, name: active.name }, cartItem);
    if (ok === false) setWarnOpen(true);
    setOptionModalItem(null);
  };

  return (
    <div className="gc-page" style={{ padding: 18 }}>
      <div className="gc-restHeader">
        <div>
          <div className="gc-pill">Restaurants</div>
          <h2 className="gc-pageTitle">Browse and add to cart</h2>
          <p className="gc-muted">Pick a spot, tap add. Checkout anytime.</p>
        </div>

        <button
          className="gc-miniBtn"
          onClick={() => navigate("/customer/checkout")}
          disabled={items.length === 0}
          title={items.length === 0 ? "Cart is empty" : "Go to checkout"}
        >
          Cart - {items.length || 0}
        </button>
      </div>

      <div className="gc-restGrid">
        <div className="gc-panel">
          <h3 className="gc-panelTitle">Restaurants</h3>

          <div className="gc-restList">
            {restaurants.map((r) => (
              <button
                key={r.id}
                className={"gc-restCard" + (active?.id === r.id ? " isActive" : "")}
                onClick={() => setActive(r)}
              >
                <div className="gc-restRow">
                  <img
                    className="gc-restThumb"
                    src={r.thumb || brandFallback}
                    alt={r.name}
                  />
                  <div style={{ flex: 1 }}>
                    <div className="gc-restName">{r.name}</div>
                    <div className="gc-restMeta">
                      <span>ETA {r.eta || "-"}</span>
                      <span>Fee {money(r.fee || 0)}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="gc-panel">
          <div className="gc-menuTop">
            <div className="gc-menuHeaderRow">
              <img
                className="gc-brandThumb"
                src={active?.thumb || brandFallback}
                alt={active?.name || "Restaurant"}
              />
              <div>
                <h3 className="gc-panelTitle" style={{ marginBottom: 4 }}>
                  {active?.name ? `${active.name} Menu` : "Menu"}
                </h3>
                <div className="gc-muted" style={{ fontSize: 13 }}>
                  Delivery fee: {money(active?.fee || 0)} - ETA: {active?.eta || "-"}
                </div>
              </div>
            </div>
          </div>

          <div className="gc-filterBar">
            <input
              className="gc-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search menu items"
            />
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
            <button
              className="gc-filterToggle"
              type="button"
              onClick={() => setFiltersOpen("restaurants", !showFilters)}
              aria-expanded={showFilters}
            >
              {showFilters ? "Hide filters" : "Filters"}
            </button>
          </div>

          {showFilters && (
            <div className="gc-filterPanel">
              <div>
                <div className="gc-filterTitle">Category</div>
                <div className="gc-filterChips">
                  {categoryNames.length === 0 ? (
                    <span className="gc-muted" style={{ fontSize: 12 }}>
                      Add categories to see filters.
                    </span>
                  ) : (
                    categoryNames.map((cat) => (
                      <button
                        key={cat}
                        className={
                          "gc-chip" + (selectedCategories.includes(cat) ? " isActive" : "")
                        }
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
                    className={
                      "gc-chip" + (quickPrice === "under_1000" ? " isActive" : "")
                    }
                    onClick={() => applyQuickPrice("under_1000", 0, 1000)}
                  >
                    Under 1000
                  </button>
                  <button
                    className={
                      "gc-chip" + (quickPrice === "1000_2000" ? " isActive" : "")
                    }
                    onClick={() => applyQuickPrice("1000_2000", 1000, 2000)}
                  >
                    1000-2000
                  </button>
                  <button
                    className={
                      "gc-chip" + (quickPrice === "2000_4000" ? " isActive" : "")
                    }
                    onClick={() => applyQuickPrice("2000_4000", 2000, 4000)}
                  >
                    2000-4000
                  </button>
                  <button
                    className={
                      "gc-chip" + (quickPrice === "4000_plus" ? " isActive" : "")
                    }
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

          <div className="gc-menuList">
            {groupedFilteredMenu.map(([group, groupItems]) => (
              <div key={group} className="gc-menuGroup">
                <div className="gc-menuGroupTitle">{group}</div>
                <div className="gc-menuGroupList">
                  {groupItems.map((m) => (
                    <div key={m.id} className="gc-menuItem">
                      <div className="gc-menuLeft">
                        <img
                          className="gc-menuThumb"
                          src={m.thumb || brandFallback}
                          alt={m.name}
                        />
                        <div className="gc-menuInfo">
                          <div className="gc-menuName">{m.name}</div>
                          {m.desc && <div className="gc-menuDesc">{m.desc}</div>}
                          <div className="gc-menuPrice">{money(m.price)}</div>
                        </div>
                      </div>

                      <button className="gc-addBtn" onClick={() => onAdd(m)}>
                        + Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="gc-cartBar">
            <div>
              <div className="gc-cartTitle">Cart subtotal</div>
              <div className="gc-cartMoney">{money(subtotal())}</div>
            </div>

            <button
              className="gc-btn"
              style={{ width: "auto", paddingInline: 16 }}
              onClick={() => navigate("/customer/checkout")}
              disabled={items.length === 0}
            >
              Go to Checkout
            </button>
          </div>

          {items.length > 0 ? (
            <div className="gc-cartList">
              {items.map((item) => (
                <div key={item.cartId || item.id} className="gc-cartRow">
                  <div>
                    <div className="gc-cartItemName">{item.name}</div>
                    <div className="gc-cartItemMeta">
                      Qty {item.qty} - {money(item.price)}
                    </div>
                    {item.options?.length ? (
                      <div className="gc-cartItemMeta">
                        {item.options
                          .map((group) =>
                            group.choices.map((c) => c.label).join(" / ")
                          )
                          .filter(Boolean)
                          .join(" ? ")}
                      </div>
                    ) : null}
                  </div>
                  <div className="gc-cartActions">
                    <div className="gc-cartItemTotal">{money(item.price * item.qty)}</div>
                    <div className="gc-cartActionBtns">
                      <button
                        className="gc-cartBtn"
                        type="button"
                        onClick={() => decItem(item.cartId || item.id)}
                      >
                        -
                      </button>
                      <button
                        className="gc-cartBtn"
                        type="button"
                        onClick={() => incItem(item.cartId || item.id)}
                      >
                        +
                      </button>
                      <button
                        className="gc-cartRemove"
                        type="button"
                        onClick={() => removeItem(item.cartId || item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

        </div>
      </div>

      {warnOpen ? (
        <div className="gc-modalOverlay" role="dialog" aria-modal="true">
          <div className="gc-modalCard">
            <h3 className="gc-panelTitle">Cart locked to one restaurant</h3>
            <p className="gc-muted" style={{ marginTop: 6 }}>
              Your cart has items from another restaurant. Checkout or clear the cart before
              adding items from a new restaurant.
            </p>
            <div className="gc-modalActions">
              <button className="gc-miniBtn" type="button" onClick={() => setWarnOpen(false)}>
                Keep browsing
              </button>
              <button
                className="gc-miniBtn brand"
                type="button"
                onClick={() => {
                  setWarnOpen(false);
                  navigate("/customer/checkout");
                }}
              >
                Go to checkout
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {optionModalItem ? (
        <div className="gc-modalOverlay" role="dialog" aria-modal="true">
          <div className="gc-modalCard gc-optionModal">
            <div className="gc-optionHeader">
              <div>
                <div className="gc-panelTitle">Customize {optionModalItem.name}</div>
                <div className="gc-muted" style={{ fontSize: 12 }}>
                  Choose your options to continue.
                </div>
              </div>
              <button
                className="gc-miniBtn"
                type="button"
                onClick={() => setOptionModalItem(null)}
              >
                Close
              </button>
            </div>

            <div className="gc-optionGroups">
              {(optionModalItem.optionGroups || []).map((group) => (
                <div key={group.id} className="gc-optionGroup">
                  <div className="gc-optionGroupTitle">
                    {group.name}
                    {group.required ? <span className="gc-optionReq">Required</span> : null}
                  </div>
                  <div className="gc-optionList">
                    {group.choices.map((choice) => {
                      const checked = (optionSelections[group.id] || []).includes(choice.id);
                      return (
                        <label key={choice.id} className="gc-optionItem">
                          <input
                            type={group.type === "multi" ? "checkbox" : "radio"}
                            name={group.id}
                            checked={checked}
                            onChange={() => selectOption(group.id, choice.id, group.type)}
                          />
                          <span className="gc-optionLabel">{choice.label}</span>
                          <span className="gc-optionPrice">
                            {choice.price ? `+${money(choice.price)}` : "Included"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {optionError ? <div className="gc-optionError">{optionError}</div> : null}

            <div className="gc-optionActions">
              <button className="gc-miniBtn" type="button" onClick={() => setOptionModalItem(null)}>
                Cancel
              </button>
              <button className="gc-miniBtn brand" type="button" onClick={confirmOptions}>
                Add to cart
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
