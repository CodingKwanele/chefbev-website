const successPanel = document.querySelector(".order-success[data-whatsapp-url]");
const whatsappUrl = successPanel?.dataset.whatsappUrl;

if (whatsappUrl) {
  window.setTimeout(() => {
    window.location.assign(whatsappUrl);
  }, 1600);
}
