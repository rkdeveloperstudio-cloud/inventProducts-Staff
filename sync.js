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

    await openDB();

    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*`, {
        headers: {
            apikey: SUPABASE_KEY,
            Authorization: "Bearer " + SUPABASE_KEY
        }
    });

    const data = await res.json();

    const tx = db.transaction("products", "readwrite");
    const store = tx.objectStore("products");

    let total = data.length;
    let count = 0;

    for (let item of data) {

        store.put(item);

        count++;

        if (count % 500 === 0) {
            let percent = Math.floor((count / total) * 100);

            progress.value = percent;
            status.innerText = `Syncing... ${count}/${total}`;
        }
    }

    progress.value = 100;
    status.innerText = "✅ Sync completed successfully";
}