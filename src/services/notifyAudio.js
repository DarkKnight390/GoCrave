import incomingOrderTone from "../assets/notification/Incoming_Order.mp3";
import incomingMessageTone from "../assets/notification/Incoming_Message.mp3";
import orderAcceptedTone from "../assets/notification/Order_Accepted.mp3";

const toneSources = {
  incomingOrder: incomingOrderTone,
  incomingMessage: incomingMessageTone,
  orderAccepted: orderAcceptedTone,
};

const tones = {};

export const playTone = (key) => {
  const src = toneSources[key];
  if (!src) return;
  if (!tones[key]) {
    tones[key] = new Audio(src);
  }
  const audio = tones[key];
  audio.currentTime = 0;
  audio.play().catch(() => {});
};
