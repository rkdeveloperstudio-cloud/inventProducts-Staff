// =====================
// CONFIG (must exist globally from config.js)
// =====================
let db = null;

// =====================
// OPEN DB SAFELY
// =====================
async function openDB() {
    return new Promise((resolve, reject) => {

        const request = indexedDB.open("InventoryDB", 1);

        request.onupgradeneeded = function (e) {
            db = e.target.result;

            if (!db.objectStoreNames.contains("products")) {
                const store = db.createObjectStore("products", {
                    keyPath: "barcode"
                });

                store.createIndex("description", "description", {
                    unique: false
                });
            }
        };

        request.onsuccess = function (e) {
            db = e.target.result;
            resolve(db);
        };

        request.onerror = reject;
    });
}

// =====================
// DOWNLOAD + SYNC (MAIN)
// =====================
async function downloadOfflineData() {

    if (!navigator.onLine) {
        alert("No internet connection.");
        return;
    }

    try {

        const status = document.getElementById("syncStatus");
        const progress = document.getElementById("syncProgress");

        status.innerText = "Preparing sync...";
        progress.value = 0;

        if (!db) await openDB();

        // =============================
        // STEP 1: GET TOTAL COUNT
        // =============================
        const countRes = await fetch(
            `${SUPABASE_URL}/rest/v1/products?select=barcode`,
            {
                method: "GET",
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: "Bearer " + SUPABASE_KEY,
                    Prefer: "count=exact"
                }
            }
        );

        const contentRange = countRes.headers.get("content-range");

        if (!contentRange) {
            throw new Error("Cannot fetch total count from Supabase");
        }

        const totalRecords = parseInt(contentRange.split("/")[1]);

        status.innerText = `Total Products: ${totalRecords}`;

        // =============================
        // STEP 2: CLEAR OLD DATA
        // =============================
        let tx = db.transaction("products", "readwrite");
        let store = tx.objectStore("products");
        store.clear();

        await txComplete(tx);

        // =============================
        // STEP 3: BATCH DOWNLOAD
        // =============================
        const batchSize = 1000;
        let downloaded = 0;

        while (downloaded < totalRecords) {

            const start = downloaded;
            const end = Math.min(downloaded + batchSize - 1, totalRecords - 1);

            status.innerText = `Downloading ${start} - ${end}`;

            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/products?select=*`,
                {
                    method: "GET",
                    headers: {
                        apikey: SUPABASE_KEY,
                        Authorization: "Bearer " + SUPABASE_KEY,
                        Range: `${start}-${end}`
                    }
                }
            );

            const rows = await res.json();

            if (!rows || rows.length === 0) break;

            // =============================
            // SAVE TO INDEXEDDB
            // =============================
            tx = db.transaction("products", "readwrite");
            store = tx.objectStore("products");

            for (const row of rows) {
                store.put(row);
            }

            await txComplete(tx);

            downloaded += rows.length;

            progress.value = Math.floor((downloaded / totalRecords) * 100);

            status.innerText = `Syncing ${downloaded} / ${totalRecords}`;

            console.log(`Synced ${downloaded}/${totalRecords}`);
        }

        progress.value = 100;
        status.innerText = `✅ Sync Completed (${downloaded})`;

        alert(`Sync completed!\nTotal: ${downloaded}`);

    } catch (err) {
        console.error(err);
        alert("Sync Error: " + err.message);
    }
}

// =====================
// SIMPLE SYNC WRAPPER
// =====================
async function syncData() {
    return await downloadOfflineData();
}

// =====================
// SAFE TX HELPER (VERY IMPORTANT)
// =====================
function txComplete(tx) {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}