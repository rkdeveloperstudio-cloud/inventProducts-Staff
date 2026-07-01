console.log("Inventory PWA Loaded - " + new Date().toLocaleString());
const SUPABASE_URL = "https://ibmwrbpucbbflnxopfwm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlibXdyYnB1Y2JiZmxueG9wZndtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NjczNjgsImV4cCI6MjA5ODI0MzM2OH0.hAf6u1Vb8Z45jC2kCLHI3pZvDk2GMNBWY6mfwcCbUts";

// =====================
// GLOBAL VARIABLES
// =====================
let codeReader = null;
let db = null;


// =====================
// DEVICE AUTHORIZATION
// =====================

function getDeviceId() {

    let id = localStorage.getItem("device_id");

    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("device_id", id);
    }

    return id;
}

function getDeviceName() {

    return navigator.userAgent;
}

async function checkDeviceAuthorization() {

    const deviceId = getDeviceId();
    const deviceName = navigator.userAgent;

    const checkUrl =
        `${SUPABASE_URL}/rest/v1/authorized_devices?device_id=eq.${encodeURIComponent(deviceId)}&select=device_id,allowed`;

    const res = await fetch(checkUrl, {
        headers: {
            apikey: SUPABASE_KEY,
            Authorization: "Bearer " + SUPABASE_KEY
        }
    });

    const data = await res.json();

    // not found → register
    if (!data || data.length === 0) {

        await fetch(`${SUPABASE_URL}/rest/v1/authorized_devices`, {
            method: "POST",
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: "Bearer " + SUPABASE_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                device_id: deviceId,
                device_name: deviceName,
                allowed: true
            })
        });

        return true;
    }

    // blocked device
    if (data[0].allowed === false) {

        document.body.innerHTML =
            "<h2 style='text-align:center;margin-top:50%'>Access Denied</h2>";

        throw new Error("Blocked device");
    }

    return true;
}


// =====================
// INIT APP
// =====================
window.addEventListener("load", async () => {

    try {
        const ok = await checkDeviceAuthorization();
    } catch (e) {
        console.warn("Auth failed - allowing offline mode");
    }

    initDB();
});// =====================
// INDEXEDDB SETUP
// =====================
function initDB() {
    const request = indexedDB.open("InventoryDB", 1);

    request.onupgradeneeded = function (e) {
        db = e.target.result;

        const store = db.createObjectStore("products", {
            keyPath: "barcode"
        });

        store.createIndex("description", "description", { unique: false });
    };

    request.onsuccess = function (e) {
        db = e.target.result;
        console.log("IndexedDB Ready");
    };

    request.onerror = function () {
        console.error("IndexedDB Failed");
    };
}

async function downloadOfflineData() {

    if (!db) return alert("DB not ready");
    if (!navigator.onLine) return alert("No internet connection");

    const modal = document.getElementById("syncModal");
    const bar = document.getElementById("syncBar");
    const text = document.getElementById("syncText");
    const status = document.getElementById("syncStatus");

    modal.style.display = "block";
    bar.style.width = "0%";
    text.innerText = "Starting...";
    status.innerText = "Downloading data...";

    try {

        const url = `${SUPABASE_URL}/rest/v1/products?select=barcode,description,price,qty_on_hand,latest_purchase_date`;

        const res = await fetch(url, {
            method: "GET",
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: "Bearer " + SUPABASE_KEY
            }
        });

        // ❗ IMPORTANT: HANDLE ERRORS PROPERLY
        if (!res.ok) {
            const errText = await res.text();
            console.error("Supabase Error:", errText);
            status.innerText = "❌ Sync failed (API error)";
            return;
        }

        const data = await res.json();

        if (!data || data.length === 0) {
            status.innerText = "No data found in database";
            return;
        }

        const total = data.length;
        let count = 0;

        const tx = db.transaction("products", "readwrite");
        const store = tx.objectStore("products");

        for (let item of data) {

            store.put(item);
            count++;

            let percent = Math.floor((count / total) * 100);

            bar.style.width = percent + "%";
            text.innerText = `${count} / ${total}`;
        }

        tx.oncomplete = function () {
            status.innerText = "✔ Sync Completed Successfully";

            setTimeout(() => {
                modal.style.display = "none";
            }, 1500);
        };

        tx.onerror = function (e) {
            console.error("IndexedDB error:", e);
            status.innerText = "❌ Local DB error";
        };

    } catch (err) {
        console.error(err);
        status.innerText = "❌ Sync failed (network or server error)";
    }
}


// =====================
// CHECK ONLINE STATUS
// =====================
function isOnline() {
    return navigator.onLine;
}

// =====================
// BARCODE SEARCH (SMART)
// =====================
async function searchByBarcode() {

    const barcode = document.getElementById("barcodeBox").value.trim();
    if (!barcode) return;

    if (isOnline()) {

        const url =
            `${SUPABASE_URL}/rest/v1/products?select=barcode,description,price,qty_on_hand,latest_purchase_date&barcode=eq.${encodeURIComponent(barcode)}`;

        const res = await fetch(url, {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: "Bearer " + SUPABASE_KEY
            }
        });

        const data = await res.json();
        showResults(data);

    } else {
        searchByBarcodeOffline(barcode);
    }
}

// =====================
// KEYWORD SEARCH (SMART)
// =====================
async function searchByKeyword() {

    const keyword = document.getElementById("keywordBox").value.trim();
    if (!keyword) return;

    if (isOnline()) {

        const url =
            `${SUPABASE_URL}/rest/v1/products?select=barcode,description,price,qty_on_hand,latest_purchase_date&description=ilike.*${encodeURIComponent(keyword)}*`;

        const res = await fetch(url, {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: "Bearer " + SUPABASE_KEY
            }
        });

        const data = await res.json();
        showResults(data);

    } else {
        searchByKeywordOffline(keyword);
    }
}

// =====================
// OFFLINE BARCODE SEARCH
// =====================
function searchByBarcodeOffline(barcode) {

    const tx = db.transaction("products", "readonly");
    const store = tx.objectStore("products");

    const req = store.get(barcode);

    req.onsuccess = function () {
        const result = req.result ? [req.result] : [];
        showResults(result);
    };
}

// =====================
// OFFLINE KEYWORD SEARCH
// =====================
function searchByKeywordOffline(keyword) {

    const tx = db.transaction("products", "readonly");
    const store = tx.objectStore("products");

    const req = store.getAll();

    req.onsuccess = function () {

        const data = req.result;

        const filtered = data.filter(p =>
            p.description &&
            p.description.toLowerCase().includes(keyword.toLowerCase())
        );

        showResults(filtered);
    };
}

// =====================
// FORMAT HELPERS
// =====================
function formatMoney(value) {
    return parseFloat(value || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDate(value) {
    if (!value) return "-";

    const d = new Date(value);

    return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

// =====================
// SHOW RESULTS
// =====================
function showResults(data) {

    const div = document.getElementById("results");
    div.innerHTML = "";

    if (!data || data.length === 0) {
        div.innerHTML = "<p>No results</p>";
        return;
    }

    let html = "";

    data.forEach(p => {

        const qty = parseInt(p.qty_on_hand || 0);

        const qtyColor =
            qty < 0 ? "red" :
            qty === 0 ? "gray" :
            "green";

        html += `
<div class="product">

    <div style="font-size:15px;font-weight:bold;color:#1565c0;">
        ${p.barcode || ""}
    </div>

    <div style="font-size:18px;font-weight:bold;margin:8px 0;">
        ${p.description || ""}
    </div>

    <hr>

    <div><b>Price :</b> ${formatMoney(p.price)}</div>

    <div>
        <b>Qty :</b>
        <span style="color:${qtyColor}; font-weight:bold;">
            ${qty}
        </span>
    </div>

    <div><b>Latest Purchase :</b> ${p.latest_purchase_date ? formatDate(p.latest_purchase_date) : "-"}</div>

</div>`;
    });

    div.innerHTML = html;
}

// =====================
// OPEN CAMERA SCANNER
// =====================
async function openScanner() {

    try {

        if (!window.ZXing) {
            alert("ZXing not loaded");
            return;
        }

        document.getElementById("scannerContainer").style.display = "block";

        codeReader = new ZXing.BrowserMultiFormatReader();

        const devices = await codeReader.listVideoInputDevices();

        if (!devices.length) {
            alert("No camera found");
            return;
        }

        let back = devices.find(d =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("rear") ||
            d.label.toLowerCase().includes("environment")
        );

        const deviceId = back ? back.deviceId : devices[0].deviceId;

        codeReader.decodeFromVideoDevice(deviceId, "scannerVideo", (result) => {

            if (result) {
                document.getElementById("barcodeBox").value = result.text;

                closeScanner();
                searchByBarcode();
            }
        });

    } catch (e) {
        alert("Camera error: " + e.message);
    }
}

// =====================
// CLOSE SCANNER
// =====================
function closeScanner() {

    if (codeReader) {
        codeReader.reset();
        codeReader = null;
    }

    document.getElementById("scannerContainer").style.display = "none";
}