import { IDBPDatabase, openDB } from 'idb';

let dbPromise: Promise<IDBPDatabase<unknown>>;

export const getDB = () => {
    if (!dbPromise) {
        dbPromise = openDB('lontar_db', 1, {
            upgrade(db) {
                db.createObjectStore('lontar_db_store');
            },
        });
    }

    return dbPromise;
};

export const setItem = async (key: string, value: Uint8Array) => {
    const db = await getDB();
    return db.put('lontar_db_store', value, key);
};

export const getItem = async (key: string) => {
    const db = await getDB();
    return db.get('lontar_db_store', key) as Promise<Uint8Array>;
};
