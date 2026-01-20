import logo from "../../assets/logo.png";

export default function SplashScreen({ fadingOut = false }) {
  return (
    <div className={`gc-splash ${fadingOut ? "gc-splashOut" : ""}`}>
      <div className="gc-splashCard">
        <div className="gc-logoWrap">
          <img
            className="gc-logoAnim"
            src={logo}
            alt="GoCrave"
            style={{
              width: 200,
              height: "auto",
              filter: "drop-shadow(0 14px 32px rgba(255,106,0,0.35))",
            }}
          />
        </div>

        <p className="gc-splashText">
          Loading GoCrave… getting your cravings ready.
        </p>

        <div className="gc-progress">
          <div />
        </div>
      </div>
    </div>
  );
}
