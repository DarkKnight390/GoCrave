import { useEffect, useState } from "react";
import {
  createCategory,
  createMenuItem,
  createRestaurant,
  deleteCategory,
  deleteMenuItem,
  deleteRestaurant,
  listenCategoriesWithItems,
  listenRestaurants,
  updateCategory,
  updateMenuItem,
  updateRestaurant,
} from "../../services/restaurants.service";
import { uploadImage } from "../../services/storage.service";

const money = (n) =>
  new Intl.NumberFormat("en-JM", { style: "currency", currency: "JMD" }).format(n);

export default function AdminRestaurants() {
  const [restaurants, setRestaurants] = useState([]);
  const [categories, setCategories] = useState([]);

  const [restaurantForm, setRestaurantForm] = useState({
    name: "",
    eta: "",
    fee: "",
    thumb: "",
  });
  const [restaurantFile, setRestaurantFile] = useState(null);
  const [editingRestaurantId, setEditingRestaurantId] = useState("");

  const [categoryForm, setCategoryForm] = useState({
    restaurantId: "",
    name: "",
  });
  const [editingCategoryId, setEditingCategoryId] = useState("");

  const [itemForm, setItemForm] = useState({
    restaurantId: "",
    categoryId: "",
    name: "",
    price: "",
    thumb: "",
  });
  const [itemFile, setItemFile] = useState(null);
  const [editingItemId, setEditingItemId] = useState("");
  const [itemOptions, setItemOptions] = useState([]);
  const [importText, setImportText] = useState("");

  useEffect(() => {
    const unsub = listenRestaurants((list) => {
      setRestaurants(list);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!categoryForm.restaurantId) {
      setCategories([]);
      return undefined;
    }
    const unsub = listenCategoriesWithItems(categoryForm.restaurantId, (list) => {
      setCategories(list);
    });
    return () => unsub();
  }, [categoryForm.restaurantId]);

  useEffect(() => {
    if (!itemForm.restaurantId) {
      setCategories([]);
      return undefined;
    }
    const unsub = listenCategoriesWithItems(itemForm.restaurantId, (list) => {
      setCategories(list);
    });
    return () => unsub();
  }, [itemForm.restaurantId]);

  const submitRestaurant = async (e) => {
    e.preventDefault();
    if (editingRestaurantId) {
      let thumb = restaurantForm.thumb;
      if (restaurantFile) {
        thumb = await uploadImage(
          `restaurants/${editingRestaurantId}/${restaurantFile.name}`,
          restaurantFile
        );
      }
      await updateRestaurant(editingRestaurantId, { ...restaurantForm, thumb });
      setEditingRestaurantId("");
    } else {
      const created = await createRestaurant(restaurantForm);
      let thumb = restaurantForm.thumb;
      if (restaurantFile) {
        thumb = await uploadImage(
          `restaurants/${created.id}/${restaurantFile.name}`,
          restaurantFile
        );
        await updateRestaurant(created.id, { thumb });
      }
    }
    setRestaurantForm({ name: "", eta: "", fee: "", thumb: "" });
    setRestaurantFile(null);
  };

  const submitCategory = async (e) => {
    e.preventDefault();
    if (editingCategoryId) {
      await updateCategory(categoryForm.restaurantId, editingCategoryId, {
        name: categoryForm.name,
      });
      setEditingCategoryId("");
    } else {
      await createCategory(categoryForm);
    }
    setCategoryForm((s) => ({ ...s, name: "" }));
  };

  const submitItem = async (e) => {
    e.preventDefault();
    const options = itemOptions
      .map((group, idx) => ({
        id: group.id || `grp_${idx}`,
        name: String(group.name || "").trim(),
        type: group.type === "multi" ? "multi" : "single",
        required: group.required !== false,
        choices: (group.choices || [])
          .map((choice, cIdx) => ({
            id: choice.id || `opt_${idx}_${cIdx}`,
            label: String(choice.label || "").trim(),
            price: Number(choice.price || 0),
          }))
          .filter((choice) => choice.label),
      }))
      .filter((group) => group.name && group.choices.length);
    if (editingItemId) {
      let thumb = itemForm.thumb;
      if (itemFile) {
        thumb = await uploadImage(
          `menus/${itemForm.restaurantId}/${itemForm.categoryId}/${itemFile.name}`,
          itemFile
        );
      }
      await updateMenuItem(itemForm.restaurantId, itemForm.categoryId, editingItemId, {
        name: itemForm.name,
        price: itemForm.price,
        thumb,
        options,
      });
      setEditingItemId("");
    } else {
      const created = await createMenuItem({ ...itemForm, options });
      let thumb = itemForm.thumb;
      if (itemFile) {
        thumb = await uploadImage(
          `menus/${itemForm.restaurantId}/${itemForm.categoryId}/${itemFile.name}`,
          itemFile
        );
        await updateMenuItem(itemForm.restaurantId, itemForm.categoryId, created.id, {
          thumb,
        });
      }
    }
    setItemForm((s) => ({ ...s, name: "", price: "", thumb: "" }));
    setItemFile(null);
    setItemOptions([]);
  };

  const startEditRestaurant = (restaurant) => {
    setEditingRestaurantId(restaurant.id);
    setRestaurantForm({
      name: restaurant.name || "",
      eta: restaurant.eta || "",
      fee: restaurant.fee || "",
      thumb: restaurant.thumb || "",
    });
  };

  const startEditCategory = (restaurantId, category) => {
    setEditingCategoryId(category.id);
    setCategoryForm({ restaurantId, name: category.name || "" });
  };

  const startEditItem = (restaurantId, categoryId, item) => {
    setEditingItemId(item.id);
    setItemForm({
      restaurantId,
      categoryId,
      name: item.name || "",
      price: item.price || "",
      thumb: item.thumb || "",
    });
    setItemOptions(Array.isArray(item.options) ? item.options : []);
  };

  const moveCategory = async (categoryId, direction) => {
    const index = categories.findIndex((c) => c.id === categoryId);
    if (index < 0) return;
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= categories.length) return;
    const current = categories[index];
    const swap = categories[swapIndex];
    await updateCategory(categoryForm.restaurantId, current.id, { order: swap.order || 0 });
    await updateCategory(categoryForm.restaurantId, swap.id, { order: current.order || 0 });
  };

  const toggleItemAvailability = async (restaurantId, categoryId, item) => {
    await updateMenuItem(restaurantId, categoryId, item.id, {
      isAvailable: item.isAvailable === false,
    });
  };

  const handleImport = async () => {
    if (!importText.trim()) return;
    try {
      const payload = JSON.parse(importText);
      const restaurantId = payload.restaurantId;
      if (!restaurantId) throw new Error("Missing restaurantId");
      const cats = payload.categories || [];

      for (const cat of cats) {
        const createdCategory = await createCategory({
          restaurantId,
          name: cat.name || "Menu",
        });
        const items = cat.items || [];
        for (const item of items) {
          await createMenuItem({
            restaurantId,
            categoryId: createdCategory.id,
            name: item.name,
            price: item.price,
            thumb: item.thumb || "",
            options: item.options || [],
          });
        }
      }
      setImportText("");
    } catch (err) {
      alert(err?.message || "Invalid import JSON");
    }
  };

  return (
    <div className="gc-adminDashboard">
      <div className="gc-adminCard">
        <div className="gc-adminCardHeader">
          <div>
            <div className="gc-adminCardTitle">Restaurant Settings</div>
            <div className="gc-adminCardSub">
              Manage restaurants, categories, and menu items shown to customers.
            </div>
          </div>
        </div>

        <div className="gc-restGrid">
          <div className="gc-panel">
            <h3 className="gc-panelTitle">
              {editingRestaurantId ? "Edit restaurant" : "Create restaurant"}
            </h3>
            <form onSubmit={submitRestaurant}>
              <div className="gc-field">
                <label className="gc-label">Name</label>
                <input
                  className="gc-input"
                  value={restaurantForm.name}
                  onChange={(e) =>
                    setRestaurantForm({ ...restaurantForm, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="gc-field">
                <label className="gc-label">ETA</label>
                <input
                  className="gc-input"
                  placeholder="e.g. 20-35 min"
                  value={restaurantForm.eta}
                  onChange={(e) =>
                    setRestaurantForm({ ...restaurantForm, eta: e.target.value })
                  }
                />
              </div>
              <div className="gc-field">
                <label className="gc-label">Delivery fee (JMD)</label>
                <input
                  className="gc-input"
                  inputMode="numeric"
                  value={restaurantForm.fee}
                  onChange={(e) =>
                    setRestaurantForm({ ...restaurantForm, fee: e.target.value })
                  }
                />
              </div>
              <div className="gc-field">
                <label className="gc-label">Thumbnail URL</label>
                <input
                  className="gc-input"
                  value={restaurantForm.thumb}
                  onChange={(e) =>
                    setRestaurantForm({ ...restaurantForm, thumb: e.target.value })
                  }
                />
              </div>
              <div className="gc-field">
                <label className="gc-label">Thumbnail upload</label>
                <input
                  className="gc-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setRestaurantFile(e.target.files?.[0] || null)}
                />
              </div>
              <button className="gc-btn" type="submit">
                {editingRestaurantId ? "Update restaurant" : "Add restaurant"}
              </button>
              {editingRestaurantId && (
                <button
                  className="gc-miniBtn"
                  type="button"
                  onClick={() => {
                    setEditingRestaurantId("");
                    setRestaurantForm({ name: "", eta: "", fee: "", thumb: "" });
                    setRestaurantFile(null);
                  }}
                >
                  Cancel
                </button>
              )}
            </form>
          </div>

          <div className="gc-panel">
            <h3 className="gc-panelTitle">
              {editingCategoryId ? "Edit category" : "Create category"}
            </h3>
            <form onSubmit={submitCategory}>
              <div className="gc-field">
                <label className="gc-label">Restaurant</label>
                <select
                  className="gc-select"
                  value={categoryForm.restaurantId}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, restaurantId: e.target.value })
                  }
                  required
                >
                  <option value="">Select restaurant</option>
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="gc-field">
                <label className="gc-label">Category name</label>
                <input
                  className="gc-input"
                  value={categoryForm.name}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, name: e.target.value })
                  }
                  required
                />
              </div>
              <button className="gc-btn" type="submit">
                {editingCategoryId ? "Update category" : "Add category"}
              </button>
              {editingCategoryId && (
                <button
                  className="gc-miniBtn"
                  type="button"
                  onClick={() => {
                    setEditingCategoryId("");
                    setCategoryForm((s) => ({ ...s, name: "" }));
                  }}
                >
                  Cancel
                </button>
              )}
            </form>
          </div>
        </div>

        <div className="gc-restGrid" style={{ marginTop: 16 }}>
          <div className="gc-panel">
            <h3 className="gc-panelTitle">
              {editingItemId ? "Edit menu item" : "Create menu item"}
            </h3>
            <form onSubmit={submitItem}>
              <div className="gc-field">
                <label className="gc-label">Restaurant</label>
                <select
                  className="gc-select"
                  value={itemForm.restaurantId}
                  onChange={(e) =>
                    setItemForm({
                      ...itemForm,
                      restaurantId: e.target.value,
                      categoryId: "",
                    })
                  }
                  required
                >
                  <option value="">Select restaurant</option>
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="gc-field">
                <label className="gc-label">Category</label>
                <select
                  className="gc-select"
                  value={itemForm.categoryId}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, categoryId: e.target.value })
                  }
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="gc-field">
                <label className="gc-label">Item name</label>
                <input
                  className="gc-input"
                  value={itemForm.name}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="gc-field">
                <label className="gc-label">Price (JMD)</label>
                <input
                  className="gc-input"
                  inputMode="numeric"
                  value={itemForm.price}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, price: e.target.value })
                  }
                  required
                />
              </div>
              <div className="gc-field">
                <label className="gc-label">Thumbnail URL</label>
                <input
                  className="gc-input"
                  value={itemForm.thumb}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, thumb: e.target.value })
                  }
                />
              </div>
              <div className="gc-field">
                <label className="gc-label">Thumbnail upload</label>
                <input
                  className="gc-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setItemFile(e.target.files?.[0] || null)}
                />
              </div>
              <div className="gc-field">
                <label className="gc-label">Options</label>
                <div className="gc-muted" style={{ fontSize: 12, marginBottom: 8 }}>
                  Add option groups (single-select or multi-select). Required groups must have at least one choice.
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {itemOptions.map((group, idx) => (
                    <div key={group.id || idx} className="gc-panel" style={{ padding: 10 }}>
                      <div className="gc-field" style={{ marginBottom: 8 }}>
                        <label className="gc-label">Group name</label>
                        <input
                          className="gc-input"
                          value={group.name || ""}
                          onChange={(e) => {
                            const next = [...itemOptions];
                            next[idx] = { ...group, name: e.target.value };
                            setItemOptions(next);
                          }}
                          placeholder="e.g. Chicken Type"
                        />
                      </div>
                      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
                        <label className="gc-label" style={{ marginBottom: 0 }}>
                          Type
                          <select
                            className="gc-select"
                            value={group.type || "single"}
                            onChange={(e) => {
                              const next = [...itemOptions];
                              next[idx] = { ...group, type: e.target.value };
                              setItemOptions(next);
                            }}
                          >
                            <option value="single">Single-select</option>
                            <option value="multi">Multi-select</option>
                          </select>
                        </label>
                        <label className="gc-label" style={{ marginBottom: 0 }}>
                          Required
                          <select
                            className="gc-select"
                            value={group.required === false ? "no" : "yes"}
                            onChange={(e) => {
                              const next = [...itemOptions];
                              next[idx] = { ...group, required: e.target.value === "yes" };
                              setItemOptions(next);
                            }}
                          >
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        </label>
                      </div>
                      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                        {(group.choices || []).map((choice, cIdx) => (
                          <div
                            key={choice.id || cIdx}
                            style={{ display: "grid", gap: 8, gridTemplateColumns: "2fr 1fr auto" }}
                          >
                            <input
                              className="gc-input"
                              placeholder="Choice label"
                              value={choice.label || ""}
                              onChange={(e) => {
                                const next = [...itemOptions];
                                const choices = [...(group.choices || [])];
                                choices[cIdx] = { ...choice, label: e.target.value };
                                next[idx] = { ...group, choices };
                                setItemOptions(next);
                              }}
                            />
                            <input
                              className="gc-input"
                              placeholder="Price"
                              inputMode="numeric"
                              value={choice.price ?? ""}
                              onChange={(e) => {
                                const next = [...itemOptions];
                                const choices = [...(group.choices || [])];
                                choices[cIdx] = { ...choice, price: e.target.value };
                                next[idx] = { ...group, choices };
                                setItemOptions(next);
                              }}
                            />
                            <button
                              className="gc-dangerBtn"
                              type="button"
                              onClick={() => {
                                const next = [...itemOptions];
                                const choices = [...(group.choices || [])];
                                choices.splice(cIdx, 1);
                                next[idx] = { ...group, choices };
                                setItemOptions(next);
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <button
                          className="gc-miniBtn"
                          type="button"
                          onClick={() => {
                            const next = [...itemOptions];
                            const choices = [...(group.choices || [])];
                            choices.push({
                              id: `opt_${Date.now()}`,
                              label: "",
                              price: "",
                            });
                            next[idx] = { ...group, choices };
                            setItemOptions(next);
                          }}
                        >
                          Add choice
                        </button>
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <button
                          className="gc-dangerBtn"
                          type="button"
                          onClick={() => {
                            const next = [...itemOptions];
                            next.splice(idx, 1);
                            setItemOptions(next);
                          }}
                        >
                          Remove group
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    className="gc-miniBtn"
                    type="button"
                    onClick={() =>
                      setItemOptions((prev) => [
                        ...prev,
                        {
                          id: `grp_${Date.now()}`,
                          name: "",
                          type: "single",
                          required: true,
                          choices: [],
                        },
                      ])
                    }
                  >
                    Add option group
                  </button>
                </div>
              </div>
              <button className="gc-btn" type="submit">
                {editingItemId ? "Update item" : "Add item"}
              </button>
              {editingItemId && (
                <button
                  className="gc-miniBtn"
                  type="button"
                  onClick={() => {
                    setEditingItemId("");
                    setItemForm((s) => ({ ...s, name: "", price: "", thumb: "" }));
                    setItemFile(null);
                    setItemOptions([]);
                  }}
                >
                  Cancel
                </button>
              )}
            </form>
          </div>

          <div className="gc-panel">
            <h3 className="gc-panelTitle">Live menu</h3>
            {categories.length === 0 ? (
              <p className="gc-muted">Select a restaurant to see categories and items.</p>
            ) : (
              categories.map((cat) => (
                <div key={cat.id} style={{ marginBottom: 12 }}>
                  <div className="gc-menuGroupTitle">
                    {cat.name}
                    <span className="gc-inlineActions">
                      <button
                        className="gc-miniBtn"
                        type="button"
                        onClick={() => moveCategory(cat.id, "up")}
                      >
                        Up
                      </button>
                      <button
                        className="gc-miniBtn"
                        type="button"
                        onClick={() => moveCategory(cat.id, "down")}
                      >
                        Down
                      </button>
                      <button
                        className="gc-miniBtn"
                        type="button"
                        onClick={() => startEditCategory(categoryForm.restaurantId, cat)}
                      >
                        Edit
                      </button>
                      <button
                        className="gc-dangerBtn"
                        type="button"
                        onClick={() =>
                          deleteCategory(categoryForm.restaurantId, cat.id)
                        }
                      >
                        Delete
                      </button>
                    </span>
                  </div>
                  {cat.items.length === 0 ? (
                    <div className="gc-muted" style={{ fontSize: 12 }}>
                      No items yet.
                    </div>
                  ) : (
                    cat.items.map((item) => (
                      <div
                        key={item.id}
                        className="gc-menuItem"
                        style={{ alignItems: "center" }}
                      >
                        <div>
                          <div className="gc-menuName">{item.name}</div>
                          <div className="gc-muted" style={{ fontSize: 12 }}>
                            {money(item.price)}
                          </div>
                        </div>
                        <div className="gc-inlineActions">
                          <button
                            className="gc-miniBtn"
                            type="button"
                            onClick={() =>
                              toggleItemAvailability(
                                itemForm.restaurantId,
                                cat.id,
                                item
                              )
                            }
                          >
                            {item.isAvailable === false ? "Enable" : "Disable"}
                          </button>
                          <button
                            className="gc-miniBtn"
                            type="button"
                            onClick={() =>
                              startEditItem(itemForm.restaurantId, cat.id, item)
                            }
                          >
                            Edit
                          </button>
                          <button
                            className="gc-dangerBtn"
                            type="button"
                            onClick={() =>
                              deleteMenuItem(itemForm.restaurantId, cat.id, item.id)
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="gc-panel" style={{ marginTop: 16 }}>
          <h3 className="gc-panelTitle">Manage restaurants</h3>
          {restaurants.length === 0 ? (
            <p className="gc-muted">No restaurants yet.</p>
          ) : (
            restaurants.map((restaurant) => (
              <div
                key={restaurant.id}
                className="gc-menuItem"
                style={{ alignItems: "center" }}
              >
                <div>
                  <div className="gc-menuName">{restaurant.name}</div>
                  <div className="gc-muted" style={{ fontSize: 12 }}>
                    ETA {restaurant.eta || "-"} - Fee {money(restaurant.fee || 0)}
                  </div>
                </div>
                <div className="gc-inlineActions">
                  <button
                    className="gc-miniBtn"
                    type="button"
                    onClick={() => startEditRestaurant(restaurant)}
                  >
                    Edit
                  </button>
                  <button
                    className="gc-dangerBtn"
                    type="button"
                    onClick={() => deleteRestaurant(restaurant.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
        )}
      </div>

      <div className="gc-panel" style={{ marginTop: 16 }}>
        <h3 className="gc-panelTitle">Bulk import (JSON)</h3>
        <p className="gc-muted" style={{ fontSize: 12 }}>
          Format: {"{ restaurantId, categories: [{ name, items: [{ name, price, thumb }] }] }"}
        </p>
        <textarea
          className="gc-input"
          style={{ minHeight: 140 }}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder='{"restaurantId":"...","categories":[{"name":"Burgers","items":[{"name":"Cheese Burger","price":650}]}]}'
        />
        <button className="gc-adminPrimary" type="button" onClick={handleImport}>
          Import menu
        </button>
      </div>
      </div>
    </div>
  );
}
