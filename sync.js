async function syncData() {

    if (!navigator.onLine) {
        alert("No internet for sync");
        return;
    }

    const url = `${SUPABASE_URL}/rest/v1/products?select=barcode,description,price,qty_on_hand`;

    const res = await fetch(url, {
        headers: {
            apikey: SUPABASE_KEY,
            Authorization: "Bearer " + SUPABASE_KEY
        }
    });

    const data = await res.json();

    await saveProducts(data);

    alert("Offline data synced!");
}

async function downloadOfflineData() {

    const status = document.getElementById("syncStatus");
    const progress = document.getElementById("syncProgress");

    status.innerText = "Syncing started...";
    progress.value = 0;

    if (!db) await openDB();

    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*`, {
        headers: {
            apikey: SUPABASE_KEY,
            Authorization: "Bearer " + SUPABASE_KEY
        }
    });

    const data = await res.json();

    const tx = db.transaction("products", "readwrite");
    const store = tx.objectStore("products");

    const total = data.length;

    for (let i = 0; i < total; i++) {

        store.put(data[i]);

        const percent = Math.floor(((i + 1) / total) * 100);

        progress.value = percent;
        status.innerText = `Syncing... ${i + 1} / ${total}`;

        if (i % 50 === 0) {
            await new Promise(r => setTimeout(r, 1));
        }
    }

    progress.value = 100;
    status.innerText = "✅ Sync completed successfully";
}