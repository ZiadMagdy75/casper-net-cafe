const pointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");

if (pointerQuery.matches) {
  document.querySelectorAll(".link").forEach((link) => {
    link.addEventListener("pointermove", (event) => {
      const rect = link.getBoundingClientRect();
      link.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      link.style.setProperty("--my", `${event.clientY - rect.top}px`);
    });
  });
}
