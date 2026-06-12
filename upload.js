const apiConfig = {
    uploadEndpoint: "/api/beats/upload"
};

const uploadForm = document.getElementById("uploadForm");
const uploadStatus = document.getElementById("uploadStatus");
const uploaderRole = document.getElementById("uploaderRole");
const superuserTokenRow = document.getElementById("superuserTokenRow");
const superuserTokenInput = document.getElementById("superuserToken");

function setSuperuserTokenRequirement() {
    if (!uploaderRole || !superuserTokenInput || !superuserTokenRow) return;

    const isSuperuser = uploaderRole.value === "superuser";
    superuserTokenRow.hidden = !isSuperuser;
    superuserTokenInput.disabled = !isSuperuser;
    superuserTokenInput.required = isSuperuser;
    if (!isSuperuser) {
        superuserTokenInput.value = "";
    }
    superuserTokenInput.placeholder = isSuperuser
        ? "Superuser Token (required)"
        : "Superuser Token (only required for superuser uploads)";
}

async function handleBeatUpload(event) {
    event.preventDefault();

    if (!uploadForm || !uploadStatus) return;

    if (!uploadForm.checkValidity()) {
        uploadStatus.textContent = "Please complete all upload fields.";
        return;
    }

    const formData = new FormData(uploadForm);
    const role = formData.get("uploaderRole");
    const superToken = formData.get("superuserToken");

    if (role === "superuser" && !superToken) {
        uploadStatus.textContent = "Superuser token is required for superuser uploads.";
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

        const providerText = payload.storageProvider === "google-drive"
            ? "Saved to Google Drive."
            : "Saved to local server storage.";
        const detailText = payload.storageMessage ? ` ${payload.storageMessage}` : "";
        uploadStatus.textContent = `${payload.message || "Beat uploaded."} ${providerText}${detailText}`.trim();
        uploadForm.reset();
        if (uploaderRole) {
            uploaderRole.value = "user";
        }
        setSuperuserTokenRequirement();
    } catch (error) {
        uploadStatus.textContent = error.message;
    }
}

function initUploadPage() {
    if (uploadForm) {
        uploadForm.addEventListener("submit", handleBeatUpload);
    }

    if (uploaderRole) {
        uploaderRole.addEventListener("change", setSuperuserTokenRequirement);
    }

    setSuperuserTokenRequirement();
}

document.addEventListener("DOMContentLoaded", initUploadPage);
