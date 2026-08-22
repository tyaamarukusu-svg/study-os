(() => {
  const params = new URLSearchParams(location.search);
  const requested = params.get("ui");
  const saved = localStorage.getItem("firefighterStudyOS_uiVariant");
  const variant = requested === "gpt" || requested === "claude" ? requested : (saved || "claude");
  localStorage.setItem("firefighterStudyOS_uiVariant", variant);
  document.body.dataset.ui = variant;
  window.StudyOSUI = {
    variant,
    set(next) {
      localStorage.setItem("firefighterStudyOS_uiVariant", next);
      const url = new URL(location.href);
      url.searchParams.set("ui", next);
      location.href = url.toString();
    }
  };

  addEventListener("DOMContentLoaded", () => {
    const target = document.getElementById("uiVariantSwitch");
    if (!target) return;
    target.innerHTML = `
      <span class="ui-switch-label">UI</span>
      <button type="button" data-ui="claude" class="${variant === "claude" ? "active" : ""}">A</button>
      <button type="button" data-ui="gpt" class="${variant === "gpt" ? "active" : ""}">B</button>`;
    target.querySelectorAll("button").forEach(button => {
      button.onclick = () => window.StudyOSUI.set(button.dataset.ui);
    });
  });
})();
