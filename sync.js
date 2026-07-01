async function openDB() {
    return new Promise((resolve, reject) => {

        const request = indexedDB.open("InventoryDB", 1);

        request.onupgradeneeded = function (e) {
            const db = e.target.result;

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
            resolve(e.target.result);
        };

        request.onerror = reject;
    });
}

async function downloadOfflineData() {

    if (!navigator.onLine) {
        alert("No internet connection.");
        return;
    }

    const status = document.getElementById("syncStatus");
    const progress = document.getElementById("syncProgress");

    status.innerText = "Preparing sync...";
    progress.value = 0;

    const db = await openDB();

    const countRes = await fetch(
        `${SUPABASE_URL}/rest/v1/products?select=barcode`,
        {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: "Bearer " + SUPABASE_KEY,
                Prefer: "count=exact"
            }
        }
    );

    const contentRange = countRes.headers.get("content-range");

    if (!contentRange || !contentRange.includes("/")) {
        throw new Error("Invalid Content-Range response");
    }

    const totalRecords = parseInt(contentRange.split("/")[1]);

    status.innerText = `Total Products: ${totalRecords}`;

    let tx = db.transaction("products", "readwrite");
    let store = tx.objectStore("products");
    store.clear();

    await txComplete(tx);

    const batchSize = 1000;
    let downloaded = 0;

    while (downloaded < totalRecords) {

        const end = Math.min(downloaded + batchSize - 1, totalRecords - 1);

        status.innerText = `Downloading ${downloaded} - ${end}`;

        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/products?select=*`,
            {
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: "Bearer " + SUPABASE_KEY,
                    Range: `${downloaded}-${end}`
                }
            }
        );

        const rows = await res.json();

        if (!rows.length) break;

        tx = db.transaction("products", "readwrite");
        store = tx.objectStore("products");

        rows.forEach(row => store.put(row));

        await txComplete(tx);

        downloaded += rows.length;

        progress.value = Math.floor((downloaded / totalRecords) * 100);

        status.innerText = `Syncing ${downloaded} / ${totalRecords}`;

        await new Promise(r => setTimeout(r, 30));
    }

    progress.value = 100;
    status.innerText = `✅ Sync Completed (${downloaded})`;

    alert("Sync completed!");
}

function syncData() {
    return downloadOfflineData();
}

function txComplete(tx) {
    return new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = reject;
        tx.onabort = reject;
    });
}