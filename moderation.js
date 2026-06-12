const moderationConfig = {
    beatsEndpoint: "/api/beats",
    approveEndpointBase: "/api/beats"
};

const tokenInput = document.getElementById("moderationToken");
const loadPendingBtn = document.getElementById("loadPendingBtn");
const moderationStatus = document.getElementById("moderationStatus");
const moderationList = document.getElementById("moderationList");

let currentToken = "";

function formatMoney(value) {
    return new Intl.NumberFormat("fr-CM", {
        style: "currency",
        currency: "XAF",
        maximumFractionDigits: 0
    }).format(value || 0);
}

function setStatus(message, isError = false) {
    if (!moderationStatus) return;
    moderationStatus.textContent = message;
    moderationStatus.style.color = isError ? "#d85757" : "#ff8c42";
}

function setLoading(isLoading) {
    if (!loadPendingBtn) return;
    loadPendingBtn.disabled = isLoading;
    loadPendingBtn.textContent = isLoading ? "Loading..." : "Load Pending";
}

function renderPendingBeats(pendingBeats) {
    if (!moderationList) return;

    if (!pendingBeats.length) {
        moderationList.innerHTML = '<p class="empty-state">No pending uploads right now.</p>';
        return;
    }

    moderationList.innerHTML = pendingBeats.map((beat) => `
        <article class="moderation-card">
            <div class="moderation-card-art" aria-hidden="true">
                ${beat.coverImageUrl
        ? `<img src="${beat.coverImageUrl}" alt="${beat.title} cover art" class="moderation-cover-image">`
        : '<i class="fas fa-wave-square"></i>'}
            </div>
            <div class="moderation-card-main">
                <h3>${beat.title}</h3>
                <p>Producer: ${beat.producer}</p>
                <p>Uploaded By: ${beat.uploadedBy} (${beat.uploaderRole})</p>
                <p>Genre: ${beat.genre} | BPM: ${beat.bpm} | Key: ${beat.key}</p>
                <p>Price: ${formatMoney(beat.price)}</p>
            </div>
            <div class="moderation-card-actions">
                <button class="checkout-btn moderation-approve-btn" type="button" data-action="approve" data-beat-id="${beat.id}">
                    <i class="fas fa-check"></i> Approve
                </button>
                <button class="play-beat-btn moderation-reject-btn" type="button" data-action="reject" data-beat-id="${beat.id}">
                    <i class="fas fa-trash"></i> Reject
                </button>
            </div>
        </article>
    `).join("");
}

async function loadPendingBeats() {
    const token = (tokenInput?.value || "").trim();
    if (!token) {
        setStatus("Enter superuser token first.", true);
        return;
    }

    currentToken = token;
    localStorage.setItem("betobeats_superuser_token", token);

    setLoading(true);
    setStatus("Loading pending uploads...");

    try {
        const response = await fetch(`${moderationConfig.beatsEndpoint}?includePending=true&superuserToken=${encodeURIComponent(token)}`);
        const payload = await response.json();

        if (!response.ok) {
            throw new Error(payload.error || "Could not load beats.");
        }

        if (!payload.canViewAll) {
            throw new Error("Invalid superuser token.");
        }

        const pendingBeats = Array.isArray(payload.beats)
            ? payload.beats.filter((beat) => beat.status === "pending")
            : [];

        renderPendingBeats(pendingBeats);
        setStatus(`Loaded ${pendingBeats.length} pending upload(s).`);
    } catch (error) {
        renderPendingBeats([]);
        setStatus(error.message, true);
    } finally {
        setLoading(false);
    }
}

async function approveBeat(beatId, button) {
    if (!currentToken) {
        setStatus("Load pending uploads with a valid token first.", true);
        return;
    }

    button.disabled = true;
    button.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Approving...";

    try {
        const response = await fetch(`${moderationConfig.approveEndpointBase}/${beatId}/approve`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ superuserToken: currentToken })
        });

        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || "Approval failed.");
        }

        setStatus("Beat approved successfully.");
        await loadPendingBeats();
    } catch (error) {
        setStatus(error.message, true);
        button.disabled = false;
        button.innerHTML = "<i class='fas fa-check'></i> Approve";
    }
}

async function rejectBeat(beatId, button) {
    if (!currentToken) {
        setStatus("Load pending uploads with a valid token first.", true);
        return;
    }

    button.disabled = true;
    button.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Removing...";

    try {
        const response = await fetch(`${moderationConfig.approveEndpointBase}/${beatId}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ superuserToken: currentToken })
        });

        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || "Delete failed.");
        }

        setStatus("Pending beat rejected and deleted.");
        await loadPendingBeats();
    } catch (error) {
        setStatus(error.message, true);
        button.disabled = false;
        button.innerHTML = "<i class='fas fa-trash'></i> Reject";
    }
}

function wireModerationEvents() {
    if (loadPendingBtn) {
        loadPendingBtn.addEventListener("click", loadPendingBeats);
    }

    if (tokenInput) {
        tokenInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                loadPendingBeats();
            }
        });
    }

    if (moderationList) {
        moderationList.addEventListener("click", (event) => {
            const actionButton = event.target.closest("button[data-beat-id]");
            if (!actionButton) return;

            const beatId = Number(actionButton.dataset.beatId);
            if (!Number.isInteger(beatId) || beatId <= 0) return;

            if (actionButton.dataset.action === "reject") {
                rejectBeat(beatId, actionButton);
                return;
            }

            approveBeat(beatId, actionButton);
        });
    }
}

function initModerationPage() {
    const storedToken = localStorage.getItem("betobeats_superuser_token") || "";
    if (tokenInput && storedToken) {
        tokenInput.value = storedToken;
    }

    wireModerationEvents();
    renderPendingBeats([]);
    setStatus("Enter your superuser token and click Load Pending.");
}

document.addEventListener("DOMContentLoaded", initModerationPage);
