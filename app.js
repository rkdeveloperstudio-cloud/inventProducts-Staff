let db = null;
let codeReader = null;

console.log("Inventory App Loaded");

// =====================
// GLOBAL EXPORT (IMPORTANT)
// =====================
function exportGlobals() {
    window.searchByBarcode = searchByBarcode;
    window.searchByKeyword = searchByKeyword;
    window.openScanner = openScanner;
    window.closeScanner = closeScanner;
    window.downloadOfflineData = downloadOfflineData;
}

document.addEventListener("DOMContentLoaded", exportGlobals);

// =====================
// BARCODE SEARCH
// =====================
async function searchByBarcode() {

    const barcode = document.getElementById("barcodeBox").value.trim();
    if (!barcode) return;

    if (!navigator.onLine) {

        if (!db) await openDB();

        const tx = db.transaction("products", "readonly");
        const store = tx.objectStore("products");

        const req = store.get(barcode);

        const result = await new Promise(resolve => {
            req.onsuccess = () => resolve(req.result ? [req.result] : []);
        });

        showResults(result);
        return;
    }

    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/products?select=barcode,description,price,qty_on_hand&barcode=eq.${barcode}`,
        {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: "Bearer " + SUPABASE_KEY
            }
        }
    );

    const data = await res.json();
    showResults(data);
}

// =====================
// KEYWORD SEARCH
// =====================
async function searchByKeyword() {

    const keyword = document.getElementById("keywordBox").value.trim();
    if (!keyword) return;

    if (!navigator.onLine) {

        if (!db) await openDB();

        const tx = db.transaction("products", "readonly");
        const store = tx.objectStore("products");

        const result = [];

        const req = store.openCursor();

        req.onsuccess = (e) => {
            const cursor = e.target.result;

            if (cursor) {

                if ((cursor.value.description || "")
                    .toLowerCase()
                    .includes(keyword.toLowerCase())) {

                    result.push(cursor.value);
                }

                cursor.continue();

            } else {
                showResults(result);
            }
        };

        return;
    }

    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/products?select=barcode,description,price,qty_on_hand&description=ilike.*${keyword}*`,
        {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: "Bearer " + SUPABASE_KEY
            }
        }
    );

    const data = await res.json();
    showResults(data);
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

    div.innerHTML = data.map(p => `
        <div class="product">
            <b>${p.barcode || ""}</b><br>
            ${p.description || ""}<br>
            Price: ${p.price ?? 0}
        </div>
    `).join("");
}

// =====================
// CAMERA SCANNER (FIXED)
// =====================
async function openScanner() {

    try {

        if (!navigator.mediaDevices) {
            alert("Camera not supported");
            return;
        }

        // IMPORTANT: ask permission INSIDE function
        await navigator.mediaDevices.getUserMedia({ video: true });

        document.getElementById("scannerContainer").style.display = "block";

        codeReader = new ZXing.BrowserMultiFormatReader();

        const devices = await codeReader.listVideoInputDevices();

        if (!devices.length) {
            alert("No camera found");
            return;
        }

        const selectedDevice =
            devices.find(d =>
                /back|rear|environment/i.test(d.label)
            ) || devices[0];

        codeReader.decodeFromVideoDevice(
            selectedDevice.deviceId,
            "scannerVideo",
            (result) => {

                if (result) {
                    document.getElementById("barcodeBox").value = result.text;
                    closeScanner();
                    searchByBarcode();
                }
            }
        );

    } catch (err) {
        console.error(err);
        alert("Camera error: " + err.message);
    }
}

// =====================
function closeScanner() {

    if (codeReader) {
        codeReader.reset();
        codeReader = null;
    }

    document.getElementById("scannerContainer").style.display = "none";
}

// =====================
// DB
// =====================
function openDB() {

    return new Promise((resolve, reject) => {

        const req = indexedDB.open("InventoryDB", 1);

        req.onupgradeneeded = (e) => {

            db = e.target.result;

            if (!db.objectStoreNames.contains("products")) {
                db.createObjectStore("products", {
                    keyPath: "barcode"
                });
            }
        };

        req.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };

        req.onerror = reject;
    });
}