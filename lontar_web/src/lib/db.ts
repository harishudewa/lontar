import { IDBPDatabase, openDB } from 'idb';

let dbPromise: Promise<IDBPDatabase<unknown>>;

export const getDB = () => {
    if (!dbPromise) {
        dbPromise = openDB('lontar_db', 2, {
            upgrade(db) {
                db.createObjectStore('lontar_db_images_store');
                db.createObjectStore('lontar_db_notes_store');
            },
        });
    }

    return dbPromise;
};

export const setImage = async (key: string, value: Uint8Array) => {
    const db = await getDB();
    return db.put('lontar_db_images_store', value, key);
};

export const getImage = async (key: string) => {
    const db = await getDB();
    return db.get('lontar_db_images_store', key) as Promise<Uint8Array>;
};

export const setNote = async (noteId: string, value: Record<string, any>) => {
    const db = await getDB();
    return db.put('lontar_db_notes_store', value, noteId);
};

export const getNote = async (noteId: string) => {
    const db = await getDB();
    return db.get('lontar_db_notes_store', noteId) as Promise<Record<string, any>>;
};
