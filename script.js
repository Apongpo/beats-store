const apiConfig = {
    beatsEndpoint: "/api/beats",
    uploadEndpoint: "/api/beats/upload"
};

const checkoutConfig = {
    provider: localStorage.getItem("betobeats_checkout_provider") || "stripe",
    currency: "XAF",
    paypalMeUrl: "https://www.paypal.com/paypalme/YOUR_NAME",
    checkoutPageUrl: "./checkout.html"
};

const providerLabelMap = {
    paypal: "PayPal",
    stripe: "Card (Visa/Mastercard/Amex)"
};

const genreLabels = {
    "hip-hop": "Hip Hop",
    trap: "Trap",
    afrobeat: "Afro",
    pop: "Pop"
};

const PREVIEW_LIMIT_SECONDS = 10;

let beatsData = [];
let currentFilter = "all";
let cart = [];
let currentTrackId = null;
let fallbackTrackId = null;
let previewLimitReachedForTrackId = null;

const beatsGrid = document.getElementById("beatsGrid");
const filterButtons = document.querySelectorAll(".filter-btn");
const browseBeatsBtn = document.getElementById("browseBeatsBtn");
const cartSidebar = document.getElementById("cartSidebar");
const cartOverlay = document.getElementById("cartOverlay");
const cartToggleBtn = document.getElementById("cartToggleBtn");
const closeCartBtn = document.getElementById("closeCartBtn");
const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const cartTotal = document.getElementById("cartTotal");
const checkoutBtn = document.getElementById("checkoutBtn");
const providerButtons = document.querySelectorAll(".provider-btn");
const audioPlayer = document.getElementById("audioPlayer");
const audioElement = document.getElementById("audioElement");
const playBtn = document.getElementById("playBtn");
const closePlayerBtn = document.getElementById("closePlayerBtn");
const trackName = document.getElementById("trackName");
const progress = document.getElementById("progress");
const contactForm = document.getElementById("contactForm");
const formStatus = document.getElementById("formStatus");
const toastStack = document.getElementById("toastStack");
const uploadForm = document.getElementById("uploadForm");
const uploadStatus = document.getElementById("uploadStatus");
const uploaderRole = document.getElementById("uploaderRole");
const superuserTokenInput = document.getElementById("superuserToken");

function getBeatById(id) {
    return beatsData.find((entry) => entry.id === id);
}

function formatMoney(value) {
    return new Intl.NumberFormat("fr-CM", {
        style: "currency",
        currency: checkoutConfig.currency,
        maximumFractionDigits: 0
    }).format(value);
}

function showToast(message, type = "info") {
    if (!toastStack) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastStack.appendChild(toast);

    window.setTimeout(() => {
        toast.remove();
    }, 3000);
}

async function loadBeatsFromApi() {
    try {
        const response = await fetch(apiConfig.beatsEndpoint);
        if (!response.ok) {
            throw new Error("Could not load beats.");
        }

        const payload = await response.json();
        beatsData = Array.isArray(payload.beats) ? payload.beats : [];
    } catch (_error) {
        beatsData = [];
        showToast("Could not load beats from database.", "error");
    }
}

function getCartSummary() {
    const items = cart.map((item) => {
        const beat = getBeatById(item.id);
        if (!beat) return null;

        return {
            id: beat.id,
            title: beat.title,
            quantity: item.quantity,
            unitPrice: beat.price,
            lineTotal: beat.price * item.quantity
        };
    }).filter(Boolean);

    const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
    return { items, total };
}

function updateCheckoutProviderUI() {
    providerButtons.forEach((button) => {
        const active = button.dataset.provider === checkoutConfig.provider;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
    });
}

function saveCart() {
    localStorage.setItem("betobeats_cart", JSON.stringify(cart));
}

function loadCart() {
    try {
        const raw = localStorage.getItem("betobeats_cart");
        if (!raw) return;

        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            cart = parsed.filter((item) => item && typeof item.id === "number" && typeof item.quantity === "number");
        }
    } catch (_error) {
        cart = [];
    }
}

function pruneUnavailableCartItems() {
    const availableIds = new Set(beatsData.map((beat) => beat.id));
    cart = cart.filter((item) => availableIds.has(item.id));
    saveCart();
}

function renderBeats() {
    if (!beatsGrid) return;

    const visibleBeats = currentFilter === "all"
        ? beatsData
        : beatsData.filter((beat) => beat.genre === currentFilter);

    if (!visibleBeats.length) {
        beatsGrid.innerHTML = '<p class="empty-state">No approved beats found in this category yet.</p>';
        return;
    }

    beatsGrid.innerHTML = visibleBeats.map((beat) => `
        <article class="beat-card">
            <div class="beat-image" aria-hidden="true">
                ${beat.coverImageUrl
        ? `<img src="${beat.coverImageUrl}" alt="${beat.title} cover art" class="beat-cover-image">`
        : '<i class="fas fa-wave-square"></i>'}
            </div>
            <div class="beat-info">
                <h3>${beat.title}</h3>
                <p class="producer">By ${beat.producer}</p>
                <p class="genre">${genreLabels[beat.genre] || beat.genre}</p>
                <p class="beat-meta">${beat.bpm} BPM | ${beat.key}</p>
                <p class="beat-price">${formatMoney(beat.price)}</p>
            </div>
            <div class="beat-actions">
                <button class="play-beat-btn" type="button" data-action="preview" data-id="${beat.id}">
                    <i class="fas fa-play"></i> Preview
                </button>
                <button class="add-to-cart-btn" type="button" data-action="add" data-id="${beat.id}">
                    <i class="fas fa-cart-plus"></i> Add
                </button>
            </div>
        </article>
    `).join("");
}

function renderCart() {
    if (!cartItems || !cartCount || !cartTotal) return;

    if (!cart.length) {
        cartItems.innerHTML = '<p class="empty-state">Your cart is empty.</p>';
        cartCount.textContent = "0";
        cartTotal.textContent = formatMoney(0);
        return;
    }

    cartItems.innerHTML = cart.map((item) => {
        const beat = getBeatById(item.id);
        if (!beat) return "";

        return `
            <article class="cart-item">
                <div class="cart-item-info">
                    <h4>${beat.title}</h4>
                    <p class="price">${formatMoney(beat.price)} x ${item.quantity}</p>
                </div>
                <button class="remove-item" type="button" data-id="${item.id}" aria-label="Remove ${beat.title} from cart">
                    <i class="fas fa-trash"></i>
                </button>
            </article>
        `;
    }).join("");

    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const total = cart.reduce((sum, item) => {
        const beat = getBeatById(item.id);
        if (!beat) return sum;
        return sum + (beat.price * item.quantity);
    }, 0);

    cartCount.textContent = String(count);
    cartTotal.textContent = formatMoney(total);
}

function setActiveFilter(nextFilter) {
    currentFilter = nextFilter;

    filterButtons.forEach((button) => {
        const isActive = button.dataset.genre === nextFilter;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    renderBeats();
}

function addToCart(id) {
    const beat = getBeatById(id);
    if (!beat) return;

    const existing = cart.find((item) => item.id === id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ id, quantity: 1 });
    }

    saveCart();
    renderCart();
    showToast(`${beat.title} added to cart.`, "success");
}

function removeFromCart(id) {
    const beat = getBeatById(id);
    cart = cart.filter((item) => item.id !== id);
    saveCart();
    renderCart();
    if (beat) {
        showToast(`${beat.title} removed from cart.`, "info");
    }
}

function toggleCart(forceOpen) {
    if (!cartSidebar || !cartOverlay || !cartToggleBtn) return;

    const shouldOpen = typeof forceOpen === "boolean"
        ? forceOpen
        : !cartSidebar.classList.contains("open");

    cartSidebar.classList.toggle("open", shouldOpen);
    cartOverlay.classList.toggle("active", shouldOpen);
    cartToggleBtn.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
    document.body.style.overflow = shouldOpen ? "hidden" : "";
}

function scrollToBeats() {
    const beatsSection = document.getElementById("beats");
    if (!beatsSection) return;
    beatsSection.scrollIntoView({ behavior: "smooth" });
}

function setPlayIcon(isPlaying) {
    if (!playBtn) return;

    playBtn.innerHTML = isPlaying
        ? '<i class="fas fa-pause"></i>'
        : '<i class="fas fa-play"></i>';
    playBtn.setAttribute("aria-pressed", isPlaying ? "true" : "false");
}

function playBeat(id) {
    const beat = getBeatById(id);
    if (!beat || !audioElement || !audioPlayer || !trackName) return;

    if (currentTrackId !== id) {
        audioElement.src = beat.audioUrl;
        trackName.textContent = `${beat.title} - ${beat.producer}`;
        currentTrackId = id;
        fallbackTrackId = id;
        previewLimitReachedForTrackId = null;
    }

    audioElement.currentTime = 0;

    audioPlayer.classList.add("active");
    audioElement.play()
        .then(() => setPlayIcon(true))
        .catch(() => {
            trackName.textContent = "Preview could not start.";
            setPlayIcon(false);
            showToast("Preview could not start.", "error");
        });
}

function togglePlay() {
    if (!audioElement || !audioElement.src) return;

    if (audioElement.paused) {
        audioElement.play()
            .then(() => setPlayIcon(true))
            .catch(() => setPlayIcon(false));
    } else {
        audioElement.pause();
        setPlayIcon(false);
    }
}

function closePlayer() {
    if (!audioElement || !audioPlayer) return;

    audioElement.pause();
    audioPlayer.classList.remove("active");
    setPlayIcon(false);
}

async function checkout() {
    if (!cart.length) {
        showToast("Your cart is empty. Add beats before checkout.", "error");
        return;
    }

    const summary = getCartSummary();

    localStorage.setItem("betobeats_checkout_payload", JSON.stringify({
        items: summary.items,
        total: summary.total,
        currency: checkoutConfig.currency,
        preferredProvider: checkoutConfig.provider,
        paypalMeUrl: checkoutConfig.paypalMeUrl
    }));

    window.location.href = checkoutConfig.checkoutPageUrl;
}

function setSuperuserTokenRequirement() {
    if (!uploaderRole || !superuserTokenInput) return;

    const isSuperuser = uploaderRole.value === "superuser";
    superuserTokenInput.required = isSuperuser;
    superuserTokenInput.placeholder = isSuperuser
        ? "Superuser Token (required)"
        : "Superuser Token (only required for superuser uploads)";
}

async function handleBeatUpload(event) {
    event.preventDefault();

    if (!uploadForm || !uploadStatus) return;

    if (!uploadForm.checkValidity()) {
        uploadStatus.textContent = "Please complete all upload fields.";
        showToast("Please complete upload fields.", "error");
        return;
    }

    const formData = new FormData(uploadForm);
    const role = formData.get("uploaderRole");
    const superToken = formData.get("superuserToken");

    if (role === "superuser" && !superToken) {
        uploadStatus.textContent = "Superuser token is required for superuser uploads.";
        showToast("Superuser token required.", "error");
        return;
    }

    uploadStatus.textContent = "Uploading beat...";

    try {
        const response = await fetch(apiConfig.uploadEndpoint, {
            method: "POST",
            body: formData
        });

        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || "Beat upload failed.");
        }

        uploadStatus.textContent = payload.message || "Beat uploaded.";
        showToast(payload.message || "Beat uploaded.", "success");

        uploadForm.reset();
        if (uploaderRole) {
            uploaderRole.value = "user";
        }
        setSuperuserTokenRequirement();

        await loadBeatsFromApi();
        pruneUnavailableCartItems();
        renderBeats();
        renderCart();
    } catch (error) {
        uploadStatus.textContent = error.message;
        showToast(error.message, "error");
    }
}

function wireEventListeners() {
    if (browseBeatsBtn) {
        browseBeatsBtn.addEventListener("click", scrollToBeats);
    }
    if (cartToggleBtn) {
        cartToggleBtn.addEventListener("click", () => toggleCart(true));
    }
    if (closeCartBtn) {
        closeCartBtn.addEventListener("click", () => toggleCart(false));
    }
    if (cartOverlay) {
        cartOverlay.addEventListener("click", () => toggleCart(false));
        cartOverlay.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleCart(false);
            }
        });
    }
    if (checkoutBtn) {
        checkoutBtn.addEventListener("click", checkout);
    }
    if (playBtn) {
        playBtn.addEventListener("click", togglePlay);
    }
    if (closePlayerBtn) {
        closePlayerBtn.addEventListener("click", closePlayer);
    }

    filterButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const nextFilter = button.dataset.genre || "all";
            setActiveFilter(nextFilter);
        });
    });

    providerButtons.forEach((button) => {
        button.addEventListener("click", () => {
            checkoutConfig.provider = button.dataset.provider || "paypal";
            localStorage.setItem("betobeats_checkout_provider", checkoutConfig.provider);
            updateCheckoutProviderUI();
            const providerLabel = providerLabelMap[checkoutConfig.provider] || checkoutConfig.provider;
            showToast(`Checkout provider set to ${providerLabel}.`, "info");
        });
    });

    if (beatsGrid) {
        beatsGrid.addEventListener("click", (event) => {
            const target = event.target.closest("button[data-action]");
            if (!target) return;

            const beatId = Number(target.dataset.id);
            const action = target.dataset.action;

            if (action === "preview") {
                playBeat(beatId);
                return;
            }

            if (action === "add") {
                addToCart(beatId);
            }
        });
    }

    if (cartItems) {
        cartItems.addEventListener("click", (event) => {
            const removeButton = event.target.closest("button.remove-item");
            if (!removeButton) return;

            const beatId = Number(removeButton.dataset.id);
            removeFromCart(beatId);
        });
    }

    if (audioElement) {
        audioElement.addEventListener("timeupdate", () => {
            if (audioElement.currentTime >= PREVIEW_LIMIT_SECONDS) {
                audioElement.pause();
                audioElement.currentTime = 0;
                setPlayIcon(false);

                if (previewLimitReachedForTrackId !== currentTrackId) {
                    previewLimitReachedForTrackId = currentTrackId;
                    showToast("Preview limit reached (10 seconds).", "info");
                }
            }

            if (!audioElement.duration || !progress) {
                if (progress) progress.style.width = "0%";
                return;
            }

            const maxDuration = Math.min(audioElement.duration, PREVIEW_LIMIT_SECONDS);
            const current = Math.min(audioElement.currentTime, PREVIEW_LIMIT_SECONDS);
            const percentage = maxDuration > 0 ? (current / maxDuration) * 100 : 0;
            progress.style.width = `${percentage}%`;
        });

        audioElement.addEventListener("ended", () => {
            setPlayIcon(false);
            if (progress) progress.style.width = "0%";
        });

        audioElement.addEventListener("error", () => {
            const activeBeat = getBeatById(currentTrackId);
            if (!activeBeat) return;

            if (
                fallbackTrackId === currentTrackId
                && activeBeat.fallbackAudioUrl
                && audioElement.src !== new URL(activeBeat.fallbackAudioUrl, window.location.href).href
            ) {
                audioElement.src = activeBeat.fallbackAudioUrl;
                audioElement.play()
                    .then(() => {
                        setPlayIcon(true);
                        showToast("Primary preview missing. Playing fallback preview.", "info");
                    })
                    .catch(() => {
                        setPlayIcon(false);
                        showToast("Preview file not found.", "error");
                    });
                return;
            }

            setPlayIcon(false);
            showToast("Preview file not found.", "error");
        });
    }

    if (contactForm) {
        contactForm.addEventListener("submit", (event) => {
            event.preventDefault();

            if (!contactForm.checkValidity()) {
                if (formStatus) {
                    formStatus.textContent = "Please complete all required fields before sending.";
                }
                showToast("Please fill all required fields.", "error");
                return;
            }

            if (formStatus) {
                formStatus.textContent = "Thanks. Your message has been received.";
            }
            contactForm.reset();
            showToast("Message sent successfully.", "success");
        });
    }

    if (uploadForm) {
        uploadForm.addEventListener("submit", handleBeatUpload);
    }

    if (uploaderRole) {
        uploaderRole.addEventListener("change", setSuperuserTokenRequirement);
    }

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            if (cartSidebar && cartSidebar.classList.contains("open")) {
                toggleCart(false);
            }

            if (audioPlayer && audioPlayer.classList.contains("active")) {
                closePlayer();
            }
        }
    });
}

async function initStore() {
    loadCart();
    await loadBeatsFromApi();
    pruneUnavailableCartItems();
    renderBeats();
    renderCart();
    updateCheckoutProviderUI();
    setSuperuserTokenRequirement();
    wireEventListeners();
}

document.addEventListener("DOMContentLoaded", initStore);
