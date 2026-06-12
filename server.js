const fs = require("fs");
const path = require("path");
const express = require("express");
const dotenv = require("dotenv");
const multer = require("multer");
const sqlite3 = require("sqlite3").verbose();
const Stripe = require("stripe");
const { google } = require("googleapis");

dotenv.config();

const app = express();
const port = process.env.PORT || 4242;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const superuserToken = process.env.SUPERUSER_TOKEN || "superuser-dev-token";
const zeroDecimalCurrencies = new Set(["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"]);
const driveRootFolderRaw = process.env.GOOGLE_DRIVE_FOLDER_ID || "";
const driveSharedDriveId = process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID || "";
const driveServiceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
const drivePrivateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n");
const driveMakePublic = String(process.env.GOOGLE_DRIVE_MAKE_PUBLIC || "true").toLowerCase() === "true";

const dataDir = path.join(__dirname, "data");
const uploadsDir = path.join(__dirname, "uploads");
const dbPath = path.join(dataDir, "beats.db");

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function runCallback(error) {
        if (error) {
            reject(error);
            return;
        }
        resolve(this);
    });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
        if (error) {
            reject(error);
            return;
        }
        resolve(rows);
    });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
        if (error) {
            reject(error);
            return;
        }
        resolve(row);
    });
});

function normalizeDriveFolderId(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const folderUrlMatch = raw.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderUrlMatch?.[1]) {
        return folderUrlMatch[1];
    }

    return raw;
}

const driveRootFolderId = normalizeDriveFolderId(driveRootFolderRaw);
const looksLikePlaceholderEmail = /project-id\.iam\.gserviceaccount\.com/i.test(driveServiceEmail);
const looksLikePlaceholderKey = /YOUR_PRIVATE_KEY/i.test(drivePrivateKey);
const hasMinimumDriveValues = Boolean(driveRootFolderId && driveServiceEmail && drivePrivateKey);
const isDriveEnabled = Boolean(hasMinimumDriveValues && !looksLikePlaceholderEmail && !looksLikePlaceholderKey);

const driveStatus = isDriveEnabled
    ? { enabled: true, provider: "google-drive", reason: "Google Drive upload is active." }
    : {
        enabled: false,
        provider: "local",
        reason: hasMinimumDriveValues
            ? "Google Drive credentials look like placeholders. Update service account email/private key in .env."
            : "Google Drive not fully configured. Using local uploads."
    };

const driveAuth = isDriveEnabled
    ? new google.auth.JWT({
        email: driveServiceEmail,
        key: drivePrivateKey,
        scopes: ["https://www.googleapis.com/auth/drive"]
    })
    : null;

const drive = isDriveEnabled
    ? google.drive({ version: "v3", auth: driveAuth })
    : null;

function sanitizeFolderName(value) {
    return String(value || "beat")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "beat";
}

function buildDriveFileLink(fileId, isImage = false) {
    return isImage
        ? `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`
        : `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
}

async function ensureDriveFolder(name, parentId) {
    if (!drive) {
        throw new Error("Google Drive is not configured.");
    }

    const escapedName = String(name).replace(/'/g, "\\'");
    const query = [
        `name='${escapedName}'`,
        "mimeType='application/vnd.google-apps.folder'",
        "trashed=false",
        `'${parentId}' in parents`
    ].join(" and ");

    const listArgs = {
        q: query,
        fields: "files(id,name)",
        pageSize: 1,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
    };

    if (driveSharedDriveId) {
        listArgs.corpora = "drive";
        listArgs.driveId = driveSharedDriveId;
    }

    const existing = await drive.files.list(listArgs);

    const folder = existing.data.files?.[0];
    if (folder) {
        return folder.id;
    }

    const created = await drive.files.create({
        requestBody: {
            name,
            mimeType: "application/vnd.google-apps.folder",
            parents: [parentId]
        },
        fields: "id",
        supportsAllDrives: true
    });

    return created.data.id;
}

async function uploadFileToDrive(localPath, fileName, mimeType, parentFolderId) {
    if (!drive) {
        throw new Error("Google Drive is not configured.");
    }

    const uploaded = await drive.files.create({
        requestBody: {
            name: fileName,
            parents: [parentFolderId]
        },
        media: {
            mimeType: mimeType || "application/octet-stream",
            body: fs.createReadStream(localPath)
        },
        fields: "id",
        supportsAllDrives: true
    });

    if (driveMakePublic) {
        await drive.permissions.create({
            fileId: uploaded.data.id,
            requestBody: {
                role: "reader",
                type: "anyone"
            },
            supportsAllDrives: true
        });
    }

    return uploaded.data.id;
}

async function deleteDriveFile(fileId) {
    if (!drive || !fileId) return;

    try {
        await drive.files.delete({ fileId, supportsAllDrives: true });
    } catch (_error) {
        // Ignore deletion failures so API delete still completes for DB cleanup.
    }
}

function mapBeatRow(row) {
    return {
        id: row.id,
        title: row.title,
        producer: row.producer,
        genre: row.genre,
        bpm: row.bpm,
        key: row.musical_key,
        price: row.price,
        audioUrl: row.audio_url,
        coverImageUrl: row.cover_image_url,
        fallbackAudioUrl: row.fallback_audio_url,
        downloadUrl: `/api/beats/${row.id}/download`,
        status: row.status,
        uploadedBy: row.uploaded_by,
        uploaderRole: row.uploader_role,
        assetFolderId: row.asset_folder_id || null,
        createdAt: row.created_at
    };
}

async function initializeDatabase() {
    await dbRun(`
        CREATE TABLE IF NOT EXISTS beats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            producer TEXT NOT NULL,
            genre TEXT NOT NULL,
            bpm INTEGER NOT NULL,
            musical_key TEXT NOT NULL,
            price REAL NOT NULL,
            audio_url TEXT NOT NULL,
            cover_image_url TEXT,
            fallback_audio_url TEXT,
            status TEXT NOT NULL DEFAULT 'approved',
            uploaded_by TEXT NOT NULL,
            uploader_role TEXT NOT NULL DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const tableInfo = await dbAll("PRAGMA table_info(beats)");
    const hasCoverImageColumn = tableInfo.some((column) => column.name === "cover_image_url");
    const hasAudioDriveIdColumn = tableInfo.some((column) => column.name === "audio_drive_file_id");
    const hasCoverDriveIdColumn = tableInfo.some((column) => column.name === "cover_drive_file_id");
    const hasAssetFolderIdColumn = tableInfo.some((column) => column.name === "asset_folder_id");

    if (!hasCoverImageColumn) {
        await dbRun("ALTER TABLE beats ADD COLUMN cover_image_url TEXT");
    }

    if (!hasAudioDriveIdColumn) {
        await dbRun("ALTER TABLE beats ADD COLUMN audio_drive_file_id TEXT");
    }

    if (!hasCoverDriveIdColumn) {
        await dbRun("ALTER TABLE beats ADD COLUMN cover_drive_file_id TEXT");
    }

    if (!hasAssetFolderIdColumn) {
        await dbRun("ALTER TABLE beats ADD COLUMN asset_folder_id TEXT");
    }

    const countRow = await dbGet("SELECT COUNT(*) AS total FROM beats");
    if ((countRow?.total || 0) > 0) {
        return;
    }

    const seedBeats = [
        ["Night Skyline", "Beto", "hip-hop", 92, "F minor", 2999, "./previews/night-skyline.wav", "./Secret%20mp4.wav", "approved", "Betobeats", "superuser"],
        ["Pressure Point", "Beto", "trap", 145, "G minor", 3499, "./previews/pressure-point.wav", "./Secret%20mp4.wav", "approved", "Betobeats", "superuser"],
        ["Lagos Sunset", "Beto", "afrobeat", 108, "A minor", 3999, "./previews/lagos-sunset.wav", "./Secret%20mp4.wav", "approved", "Betobeats", "superuser"],
        ["Neon Voices", "Beto", "pop", 120, "C major", 2499, "./previews/neon-voices.wav", "./Secret%20mp4.wav", "approved", "Betobeats", "superuser"]
    ];

    for (const beat of seedBeats) {
        // eslint-disable-next-line no-await-in-loop
        await dbRun(
            `INSERT INTO beats (title, producer, genre, bpm, musical_key, price, audio_url, fallback_audio_url, status, uploaded_by, uploader_role)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            beat
        );
    }
}

const storage = multer.diskStorage({
    destination: (_req, _file, callback) => {
        callback(null, uploadsDir);
    },
    filename: (_req, file, callback) => {
        const ext = path.extname(file.originalname || "").toLowerCase() || ".wav";
        const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        callback(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024
    },
    fileFilter: (_req, file, callback) => {
        const extension = path.extname(file.originalname || "").toLowerCase();
        const allowedExtensions = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"]);
        const allowedImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
        const mimeLooksAudio = file.mimetype && file.mimetype.startsWith("audio/");
        const mimeLooksImage = file.mimetype && file.mimetype.startsWith("image/");

        if (file.fieldname === "audio" && (mimeLooksAudio || allowedExtensions.has(extension))) {
            callback(null, true);
            return;
        }

        if (file.fieldname === "coverImage" && (mimeLooksImage || allowedImageExtensions.has(extension))) {
            callback(null, true);
            return;
        }

        callback(new Error("Only audio files and image covers are allowed."));
    }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadsDir));
app.use(express.static(__dirname));

app.get("/api/storage-status", (_req, res) => {
    return res.json({
        provider: driveStatus.provider,
        driveEnabled: driveStatus.enabled,
        message: driveStatus.reason,
        folderId: driveRootFolderId || null
    });
});

app.get("/api/beats", async (req, res) => {
    try {
        const includePending = String(req.query.includePending || "").toLowerCase() === "true";
        const token = String(req.query.superuserToken || "").trim();
        const canViewAll = includePending && token && token === superuserToken;

        const rows = canViewAll
            ? await dbAll("SELECT * FROM beats ORDER BY created_at DESC")
            : await dbAll("SELECT * FROM beats WHERE status = 'approved' ORDER BY created_at DESC");

        return res.json({
            beats: rows.map(mapBeatRow),
            canViewAll
        });
    } catch (error) {
        return res.status(500).json({ error: "Could not load beats." });
    }
});

app.post("/api/beats/upload", upload.fields([
    { name: "audio", maxCount: 1 },
    { name: "coverImage", maxCount: 1 }
]), async (req, res) => {
    try {
        const {
            title,
            producer,
            genre,
            bpm,
            musicalKey,
            price,
            uploaderRole,
            uploadedBy,
            superuserToken: providedToken
        } = req.body;

        const audioFile = req.files?.audio?.[0];
        const coverImageFile = req.files?.coverImage?.[0] || null;

        if (!audioFile) {
            return res.status(400).json({ error: "Audio file is required." });
        }

        if (!title || !producer || !genre || !bpm || !musicalKey || !price || !uploadedBy) {
            return res.status(400).json({ error: "Please complete all required beat fields." });
        }

        const normalizedRole = uploaderRole === "superuser" ? "superuser" : "user";
        if (normalizedRole === "superuser" && String(providedToken || "") !== superuserToken) {
            return res.status(403).json({ error: "Invalid superuser token." });
        }

        const status = normalizedRole === "superuser" ? "approved" : "pending";
        let audioPath = `/uploads/${audioFile.filename}`;
        let coverImagePath = coverImageFile ? `/uploads/${coverImageFile.filename}` : null;
        let audioDriveFileId = null;
        let coverDriveFileId = null;
        let assetFolderId = null;

        if (isDriveEnabled) {
            const timestampLabel = Date.now();
            const folderName = `beat-${sanitizeFolderName(title)}-${timestampLabel}`;
            assetFolderId = await ensureDriveFolder(folderName, driveRootFolderId);

            audioDriveFileId = await uploadFileToDrive(
                req.files.audio[0].path,
                req.files.audio[0].originalname || `${folderName}-audio`,
                req.files.audio[0].mimetype,
                assetFolderId
            );
            audioPath = buildDriveFileLink(audioDriveFileId, false);

            if (coverImageFile) {
                coverDriveFileId = await uploadFileToDrive(
                    coverImageFile.path,
                    coverImageFile.originalname || `${folderName}-cover`,
                    coverImageFile.mimetype,
                    assetFolderId
                );
                coverImagePath = buildDriveFileLink(coverDriveFileId, true);
            }
        }

        const numericPrice = Number(price);
        const numericBpm = Number(bpm);

        if (!Number.isFinite(numericPrice) || numericPrice <= 0 || !Number.isFinite(numericBpm) || numericBpm <= 0) {
            return res.status(400).json({ error: "Price and BPM must be valid numbers." });
        }

        const result = await dbRun(
            `INSERT INTO beats (title, producer, genre, bpm, musical_key, price, audio_url, cover_image_url, fallback_audio_url, status, uploaded_by, uploader_role, audio_drive_file_id, cover_drive_file_id, asset_folder_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                String(title).trim(),
                String(producer).trim(),
                String(genre).trim(),
                Math.round(numericBpm),
                String(musicalKey).trim(),
                Math.round(numericPrice),
                audioPath,
                coverImagePath,
                "./Secret%20mp4.wav",
                status,
                String(uploadedBy).trim(),
                normalizedRole,
                audioDriveFileId,
                coverDriveFileId,
                assetFolderId
            ]
        );

        if (isDriveEnabled) {
            [audioFile.path, coverImageFile?.path].filter(Boolean).forEach((filePath) => {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            });
        }

        const row = await dbGet("SELECT * FROM beats WHERE id = ?", [result.lastID]);
        return res.status(201).json({
            message: status === "approved"
                ? "Beat uploaded and published."
                : "Beat uploaded. It is pending superuser approval.",
            beat: mapBeatRow(row),
            storageProvider: driveStatus.provider,
            storageMessage: driveStatus.reason
        });
    } catch (error) {
        return res.status(500).json({ error: error.message || "Beat upload failed." });
    }
});

app.patch("/api/beats/:id/approve", async (req, res) => {
    try {
        const beatId = Number(req.params.id);
        const providedToken = String(req.body?.superuserToken || "");

        if (!Number.isInteger(beatId) || beatId <= 0) {
            return res.status(400).json({ error: "Invalid beat id." });
        }

        if (providedToken !== superuserToken) {
            return res.status(403).json({ error: "Invalid superuser token." });
        }

        await dbRun("UPDATE beats SET status = 'approved' WHERE id = ?", [beatId]);
        const row = await dbGet("SELECT * FROM beats WHERE id = ?", [beatId]);
        if (!row) {
            return res.status(404).json({ error: "Beat not found." });
        }

        return res.json({ message: "Beat approved.", beat: mapBeatRow(row) });
    } catch (error) {
        return res.status(500).json({ error: "Beat approval failed." });
    }
});

app.delete("/api/beats/:id", async (req, res) => {
    try {
        const beatId = Number(req.params.id);
        const providedToken = String(req.body?.superuserToken || "");

        if (!Number.isInteger(beatId) || beatId <= 0) {
            return res.status(400).json({ error: "Invalid beat id." });
        }

        if (providedToken !== superuserToken) {
            return res.status(403).json({ error: "Invalid superuser token." });
        }

        const row = await dbGet("SELECT * FROM beats WHERE id = ?", [beatId]);
        if (!row) {
            return res.status(404).json({ error: "Beat not found." });
        }

        await dbRun("DELETE FROM beats WHERE id = ?", [beatId]);

        if (row.asset_folder_id) {
            await deleteDriveFile(row.asset_folder_id);
        } else {
            await Promise.all([
                deleteDriveFile(row.audio_drive_file_id),
                deleteDriveFile(row.cover_drive_file_id)
            ]);
        }

        const removablePaths = [row.audio_url, row.cover_image_url]
            .filter(Boolean)
            .map((filePath) => String(filePath).replace(/^\//, ""))
            .map((relativePath) => path.join(__dirname, relativePath))
            .filter((absolutePath) => absolutePath.startsWith(uploadsDir));

        removablePaths.forEach((absolutePath) => {
            if (fs.existsSync(absolutePath)) {
                fs.unlinkSync(absolutePath);
            }
        });

        return res.json({ message: "Beat deleted." });
    } catch (error) {
        return res.status(500).json({ error: "Beat deletion failed." });
    }
});

app.get("/api/beats/:id/download", async (req, res) => {
    try {
        const beatId = Number(req.params.id);
        if (!Number.isInteger(beatId) || beatId <= 0) {
            return res.status(400).json({ error: "Invalid beat id." });
        }

        const row = await dbGet("SELECT * FROM beats WHERE id = ?", [beatId]);
        if (!row) {
            return res.status(404).json({ error: "Beat not found." });
        }

        if (row.audio_drive_file_id) {
            return res.redirect(buildDriveFileLink(row.audio_drive_file_id, false));
        }

        if (row.audio_url) {
            return res.redirect(row.audio_url);
        }

        return res.status(404).json({ error: "No audio file found for this beat." });
    } catch (_error) {
        return res.status(500).json({ error: "Could not create download link." });
    }
});

app.use((error, _req, res, next) => {
    if (error instanceof multer.MulterError) {
        return res.status(400).json({ error: error.message });
    }

    if (error && error.message === "Only audio files and image covers are allowed.") {
        return res.status(400).json({ error: error.message });
    }

    return next(error);
});

app.post("/api/create-checkout-session", async (req, res) => {
    if (!stripe) {
        return res.status(500).json({ error: "Stripe key missing. Set STRIPE_SECRET_KEY in .env." });
    }

    const { items, currency, successUrl, cancelUrl } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Checkout items are required." });
    }

    const lineItems = [];

    for (const item of items) {
        const amount = Number(item.unitPrice);
        const quantity = Number(item.quantity);
        const normalizedCurrency = String(currency || "xaf").toLowerCase();
        const multiplier = zeroDecimalCurrencies.has(normalizedCurrency) ? 1 : 100;

        if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
            return res.status(400).json({ error: "Invalid item values." });
        }

        lineItems.push({
            quantity,
            price_data: {
                currency: normalizedCurrency,
                unit_amount: Math.round(amount * multiplier),
                product_data: {
                    name: String(item.title || "Beat License"),
                    metadata: {
                        beatId: String(item.id || "")
                    }
                }
            }
        });
    }

    try {
        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card"],
            line_items: lineItems,
            success_url: successUrl || `http://localhost:${port}/?checkout=success`,
            cancel_url: cancelUrl || `http://localhost:${port}/?checkout=cancel`,
            metadata: {
                source: "betobeats-web"
            }
        });

        return res.json({ url: session.url });
    } catch (error) {
        return res.status(500).json({ error: error.message || "Stripe session creation failed." });
    }
});

app.get("/api/verify-checkout-session", async (req, res) => {
    if (!stripe) {
        return res.status(500).json({ error: "Stripe key missing. Set STRIPE_SECRET_KEY in .env." });
    }

    const sessionId = String(req.query.session_id || "").trim();
    if (!sessionId) {
        return res.status(400).json({ error: "session_id is required." });
    }

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        return res.json({
            sessionId: session.id,
            paymentStatus: session.payment_status,
            status: session.status,
            amountTotal: session.amount_total,
            currency: session.currency
        });
    } catch (error) {
        return res.status(500).json({ error: error.message || "Could not verify checkout session." });
    }
});

app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

initializeDatabase()
    .then(() => {
        app.listen(port, () => {
            // eslint-disable-next-line no-console
            console.log(`Betobeats server running at http://localhost:${port}`);
        });
    })
    .catch((error) => {
        // eslint-disable-next-line no-console
        console.error("Failed to initialize database:", error);
        process.exit(1);
    });
