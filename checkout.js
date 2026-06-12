const stripeSessionEndpoint = "/api/create-checkout-session";
const verifySessionEndpoint = "/api/verify-checkout-session";

const checkoutMethods = document.getElementById("checkoutMethods");
const payNowBtn = document.getElementById("payNowBtn");
const checkoutItems = document.getElementById("checkoutItems");
const checkoutTotal = document.getElementById("checkoutTotal");
const checkoutStatus = document.getElementById("checkoutStatus");
const checkoutHelper = document.getElementById("checkoutHelper");
const checkoutCardNote = document.getElementById("checkoutCardNote");

let checkoutPayload = null;
let selectedProvider = "stripe";

function formatMoney(value, currency) {
    const currencyCode = String(currency || "XAF").toUpperCase();
    return new Intl.NumberFormat("fr-CM", {
        style: "currency",
        currency: currencyCode,
        maximumFractionDigits: 0
    }).format(value);
}

function setProvider(provider) {
    selectedProvider = provider;

    const methodButtons = checkoutMethods.querySelectorAll(".checkout-method");
    methodButtons.forEach((button) => {
        const isActive = button.dataset.provider === provider;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-checked", isActive ? "true" : "false");
    });

    if (provider === "stripe") {
        checkoutCardNote.textContent = "You will enter your card details on Stripe secure checkout (Visa, Mastercard, Amex, Discover).";
    } else {
        checkoutCardNote.textContent = "You will continue to PayPal to complete your payment.";
    }
}

function renderSummary() {
    if (!checkoutPayload || !Array.isArray(checkoutPayload.items) || checkoutPayload.items.length === 0) {
        checkoutItems.innerHTML = '<p class="empty-state">No checkout items found. Add beats in the store first.</p>';
        checkoutTotal.textContent = formatMoney(0, "XAF");
        payNowBtn.disabled = true;
        checkoutHelper.textContent = "Return to the store and add at least one beat to your cart.";
        return;
    }

    const currency = checkoutPayload.currency || "XAF";

    checkoutItems.innerHTML = checkoutPayload.items.map((item) => `
        <div class="checkout-item-row">
            <div>
                <h3>${item.title}</h3>
                <p>${item.quantity} x ${formatMoney(item.unitPrice, currency)}</p>
            </div>
            <strong>${formatMoney(item.lineTotal, currency)}</strong>
        </div>
    `).join("");

    checkoutTotal.textContent = formatMoney(checkoutPayload.total, currency);
    payNowBtn.disabled = false;
}

function readCheckoutPayload() {
    try {
        const raw = localStorage.getItem("betobeats_checkout_payload");
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.items)) return null;

        return parsed;
    } catch (_error) {
        return null;
    }
}

async function verifySuccessfulPayment(sessionId) {
    checkoutStatus.hidden = false;
    checkoutStatus.className = "checkout-status";
    checkoutStatus.textContent = "Verifying your payment...";

    try {
        const response = await fetch(`${verifySessionEndpoint}?session_id=${encodeURIComponent(sessionId)}`);
        if (!response.ok) {
            throw new Error("Failed to verify payment");
        }

        const payload = await response.json();
        if (payload.paymentStatus === "paid") {
            checkoutStatus.classList.add("success");
            checkoutStatus.innerHTML = `
                <h3><i class="fas fa-circle-check"></i> Payment Successful</h3>
                <p>Your payment was confirmed. Your beats are now reserved for download delivery.</p>
                <p><strong>Receipt ID:</strong> ${payload.sessionId}</p>
            `;
            localStorage.removeItem("betobeats_cart");
            localStorage.removeItem("betobeats_checkout_payload");
            return;
        }

        checkoutStatus.classList.add("error");
        checkoutStatus.textContent = "Payment status is not marked as paid yet. Please contact support if you were charged.";
    } catch (_error) {
        checkoutStatus.classList.add("error");
        checkoutStatus.textContent = "Could not verify payment right now. Please retry shortly or contact support with your receipt.";
    }
}

function showCancelledStatus() {
    checkoutStatus.hidden = false;
    checkoutStatus.className = "checkout-status error";
    checkoutStatus.innerHTML = "<h3><i class='fas fa-triangle-exclamation'></i> Payment Cancelled</h3><p>Your payment was not completed. You can choose a method and try again.</p>";
}

async function startPayment() {
    if (!checkoutPayload || !Array.isArray(checkoutPayload.items) || checkoutPayload.items.length === 0) {
        return;
    }

    const currency = checkoutPayload.currency || "XAF";

    if (selectedProvider === "paypal") {
        const paypalMeUrl = checkoutPayload.paypalMeUrl || "";
        if (!paypalMeUrl || paypalMeUrl.includes("YOUR_NAME")) {
            checkoutHelper.textContent = "Set a valid PayPal.Me username in script.js first.";
            return;
        }

        const paypalUrl = `${paypalMeUrl}/${Number(checkoutPayload.total).toFixed(2)}${currency}`;
        window.location.href = paypalUrl;
        return;
    }

    payNowBtn.disabled = true;
    payNowBtn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Redirecting...";

    try {
        const response = await fetch(stripeSessionEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                currency,
                items: checkoutPayload.items,
                successUrl: `${window.location.origin}/checkout.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
                cancelUrl: `${window.location.origin}/checkout.html?checkout=cancel`
            })
        });

        if (!response.ok) {
            throw new Error("Failed to create checkout session");
        }

        const payload = await response.json();
        if (!payload.url) {
            throw new Error("Missing Stripe checkout URL");
        }

        window.location.href = payload.url;
    } catch (_error) {
        payNowBtn.disabled = false;
        payNowBtn.innerHTML = "<i class='fas fa-lock'></i> Pay Now";
        checkoutHelper.textContent = "Payment start failed. Make sure server is running and Stripe key is set.";
    }
}

function wireCheckoutEvents() {
    checkoutMethods.addEventListener("click", (event) => {
        const methodButton = event.target.closest("button.checkout-method");
        if (!methodButton) return;

        setProvider(methodButton.dataset.provider || "stripe");
    });

    payNowBtn.addEventListener("click", startPayment);
}

function initCheckoutPage() {
    checkoutPayload = readCheckoutPayload();

    if (checkoutPayload && checkoutPayload.preferredProvider) {
        setProvider(checkoutPayload.preferredProvider);
    } else {
        setProvider("stripe");
    }

    renderSummary();
    wireCheckoutEvents();

    const params = new URLSearchParams(window.location.search);
    const state = params.get("checkout");
    const sessionId = params.get("session_id");

    if (state === "success" && sessionId) {
        verifySuccessfulPayment(sessionId);
    }

    if (state === "cancel") {
        showCancelledStatus();
    }
}

document.addEventListener("DOMContentLoaded", initCheckoutPage);
