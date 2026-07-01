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

    try {

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

        console.log("Products downloaded:", data.length);

        const tx = db.transaction("products", "readwrite");
        const store = tx.objectStore("products");

        const total = data.length;

        for (let i = 0; i < total; i++) {

            store.put(data[i]);

            progress.value = ((i + 1) / total) * 100;

            status.innerText =
                `Syncing ${i + 1} / ${total}`;
        }

        await new Promise(resolve => {
            tx.oncomplete = resolve;
        });

        status.innerText = "✅ Sync completed";

    }
    catch (err) {

        console.error(err);

        alert(err.message);

    }

}