import { createFetch, createSchema } from '@better-fetch/fetch';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { hexToBytes, managedNonce } from '@noble/ciphers/utils.js';
import { LoroDoc, LoroText, TreeID, VersionVector } from 'loro-crdt';
import * as v from 'valibot';
import { getMetadata, setMetadata } from './db';

const DUMMY_ENC_KEY = '8f55f2228b2926d1af83e4deb97c8532a579314f2bdd937aed972f0fe87e01af';

export const getCookie = (key: string) => {
    return document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${key}=`))
        ?.split('=')[1];
};

export type SetCookieParams = {
    key: string;
    value: string;
    path?: string;
    sameSite?: 'Strict' | 'Lax' | 'None';
    secure?: boolean;
    maxAge?: number;
};

export const setCookie = (params: SetCookieParams) => {
    let cookie = `${params.key}=${params.value}`;
    if (params.path) {
        cookie = `${cookie}; Path=${params.path}`;
    }
    if (params.sameSite) {
        cookie = `${cookie}; SameSite=${params.sameSite}`;
    }
    if (params.secure) {
        cookie = `${cookie}; Secure`;
    }
    if (params.maxAge) {
        cookie = `${cookie}; MaxAge=${params.maxAge}`;
    }

    document.cookie = cookie;
};

export const FetchSchema = createSchema({
    '@post/signin': {
        input: v.object({
            username: v.string(),
            password: v.string(),
        }),
        output: v.string(),
    },
    '@post/images': {
        input: v.instance(Uint8Array),
        output: v.object({
            obj_key: v.string(),
        }),
    },
    '@get/notes/:noteId': {
        output: v.object({
            id: v.string(),
            version: v.number(),
            content: v.nullable(v.string()),
            created_at: v.number(),
            updated_at: v.number(),
            deleted_at: v.nullable(v.number()),
        }),
    },
    '@post/notes': {
        input: v.object({
            metadata: v.string(),
        }),
        output: v.object({
            note_id: v.string(),
        }),
    },
    '@patch/notes/:noteId': {
        input: v.object({
            metadata: v.optional(v.string()),
            content: v.optional(v.string()),
        }),
        output: v.object({
            note_id: v.string(),
        }),
    },
});

export const $fetch = createFetch({
    baseURL: 'http://localhost:8787',
    schema: FetchSchema,
});

export const fnv1a32 = (str: string, seed: number) => {
    let h = seed;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
};

export const hashKey = (str: string) => {
    return fnv1a32(str, 0x811c9dc5) + fnv1a32(str, 0x9e3779b9);
};

export const encrypt = (val: Uint8Array) => {
    const key = hexToBytes(DUMMY_ENC_KEY);
    const chacha = managedNonce(xchacha20poly1305)(key);
    const encrypted = chacha.encrypt(val);
    return encrypted;
};

export const decrypt = (val: Uint8Array) => {
    const key = hexToBytes(DUMMY_ENC_KEY);
    const chacha = managedNonce(xchacha20poly1305)(key);
    const decrypted = chacha.decrypt(val);
    return decrypted;
};

export type UpdateNoteMetadataParams = {
    noteId: string;
    title: string;
};

export const updateNoteMetadata = async (params: UpdateNoteMetadataParams) => {
    const v: Record<string, any> = {};

    const notesMetadataCaptured = await getMetadata('notes');

    let notesMetadata: LoroDoc;
    if (!notesMetadataCaptured) {
        notesMetadata = new LoroDoc();
        v.snapshot = encrypt(notesMetadata.export({ mode: 'snapshot' }));
        v.version = notesMetadata.version().encode();
    } else {
        v.snapshot = notesMetadataCaptured.snapshot;
        v.version = notesMetadataCaptured.version;

        const snapshotBytes = decrypt(notesMetadataCaptured.snapshot);
        const updatesBytes = decrypt(notesMetadataCaptured.updates);
        notesMetadata = LoroDoc.fromSnapshot(snapshotBytes);
        notesMetadata.import(updatesBytes);
    }

    const notesMetadataMap = notesMetadata.getMap('note_metadata');
    const noteMetadata = notesMetadataMap.ensureMergeableMap(params.noteId);
    const title = noteMetadata.setContainer('title', new LoroText());
    title.insert(0, params.title);

    const updates = notesMetadata.export({ mode: 'update', from: VersionVector.decode(v.version) });
    v.updates = encrypt(updates);

    await setMetadata('notes', v);
};

export type UpdatePathMetadataParams =
    | UpdatePathMetadataInitialize
    | UpdatePathMetadataCreateNote
    | UpdatePathMetadataDeleteNote
    | UpdatePathMetadataCreateFolder
    | UpdatePathMetadataDeleteFolder;

export type UpdatePathMetadataInitialize = {
    operationType: 'init';
};

export type UpdatePathMetadataCreateNote = {
    operationType: 'createNote';
    directParentFolderId: TreeID;
    noteId: string;
};

export type UpdatePathMetadataDeleteNote = {
    operationType: 'deleteNote';
    directParentFolderId: TreeID;
    noteId: string;
};

export type UpdatePathMetadataCreateFolder = {
    operationType: 'createFolder';
    directParentFolderId: TreeID;
    name: string;
};

export type UpdatePathMetadataDeleteFolder = {
    operationType: 'deleteFolder';
    folderId: TreeID;
};

export const updatePathMetadata = async (params: UpdatePathMetadataParams) => {
    const v: Record<string, any> = {};

    const pathsMetadataCaptured = await getMetadata('paths');

    let pathsMetadata: LoroDoc;
    if (!pathsMetadataCaptured) {
        pathsMetadata = new LoroDoc();
        const rootNode = pathsMetadata.getTree('path_tree').createNode();
        rootNode.data.set('name', '/');
        v.snapshot = encrypt(pathsMetadata.export({ mode: 'snapshot' }));
        v.version = pathsMetadata.version().encode();
    } else {
        v.snapshot = pathsMetadataCaptured.snapshot;
        v.version = pathsMetadataCaptured.version;

        const snapshotBytes = decrypt(pathsMetadataCaptured.snapshot);
        const updatesBytes = decrypt(pathsMetadataCaptured.updates);
        pathsMetadata = LoroDoc.fromSnapshot(snapshotBytes);
        pathsMetadata.import(updatesBytes);
    }

    const pathTree = pathsMetadata.getTree('path_tree');

    switch (params.operationType) {
        case 'init': {
            break;
        }
        case 'createNote': {
            const parentFolderNode = pathTree.getNodeByID(params.directParentFolderId);
            if (!parentFolderNode) {
                console.error('invalid parent folder id');
                return;
            }
            const notes = parentFolderNode.data.ensureMergeableList('notes');
            const notes_index = parentFolderNode.data.ensureMergeableMap('notes_index');
            notes_index.set(params.noteId, notes.length);
            notes.insert(notes.length, params.noteId);
            break;
        }
        case 'deleteNote': {
            const parentFolderNode = pathTree.getNodeByID(params.directParentFolderId);
            if (!parentFolderNode) {
                console.error('invalid parent folder id');
                return;
            }
            const notes = parentFolderNode.data.ensureMergeableList('notes');
            const notesIndex = parentFolderNode.data.ensureMergeableMap('notes_index');
            const deletedNoteIndex = notesIndex.get(params.noteId) as number;
            notes.delete(deletedNoteIndex, 1);
            break;
        }
        case 'createFolder': {
            const parentFolderNode = pathTree.getNodeByID(params.directParentFolderId);
            if (!parentFolderNode) {
                console.error('invalid parent folder id');
                return;
            }

            // TODO: maybe need to check folder name alr exists?

            const newFolderNode = parentFolderNode.createNode();
            newFolderNode.data.set('name', `/${params.name}`);
            break;
        }
        case 'deleteFolder': {
            pathTree.delete(params.folderId);
            break;
        }
    }

    const updates = pathsMetadata.export({ mode: 'update', from: VersionVector.decode(v.version) });
    v.updates = encrypt(updates);

    await setMetadata('paths', v);
};
