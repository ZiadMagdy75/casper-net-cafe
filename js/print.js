const button = document.getElementById("print-btn");

if (button) {
  button.addEventListener("click", () => {
    window.print();
  });
}
