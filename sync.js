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

    data.forEach(item => {
        store.put(item);
    });

    alert("Offline data downloaded: " + data.length);
}