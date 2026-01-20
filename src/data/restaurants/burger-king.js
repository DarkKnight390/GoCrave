import bkLogo from "../../assets/restaurants/burger-king.png";

export const burgerKing = {
  id: "bk",
  name: "Burger King",
  eta: "15-25 min",
  fee: 250,
  thumb: bkLogo,
  menu: [
    { id: "bk_whopper", name: "Whopper", price: 1050, category: "Burgers", thumb: bkLogo },
    { id: "bk_fries", name: "Fries (Med)", price: 420, category: "Sides", thumb: bkLogo },
    { id: "bk_soda", name: "Soda", price: 220, category: "Beverages", thumb: bkLogo },
  ],
};
