import { render } from "preact";
import "./styles.css";
import { App } from "./App";
import { restorePalette } from "./components/TweaksPanel";

// Apply saved palette (cream | ink | blueprint) before first paint to avoid a theme flash.
restorePalette();

render(<App />, document.getElementById("app")!);
