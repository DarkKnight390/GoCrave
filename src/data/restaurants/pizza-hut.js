import phLogo from "../../assets/restaurants/pizza-hut.png";

export const pizzaHut = {
  id: "ph",
  name: "Pizza Hut",
  eta: "25-40 min",
  fee: 350,
  thumb: phLogo,
  menu: [
    { id: "ph_pepperoni", name: "Pepperoni Slice", price: 520, category: "Pizza", thumb: phLogo },
    { id: "ph_supreme", name: "Supreme Slice", price: 580, category: "Pizza", thumb: phLogo },
    { id: "ph_wings", name: "Wings (6pc)", price: 950, category: "Sides", thumb: phLogo },
  ],
};
