import { createFetch, createSchema } from '@better-fetch/fetch';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { hexToBytes, managedNonce } from '@noble/ciphers/utils.js';
import { LoroDoc, LoroMap, LoroText, LoroTreeNode, TreeID, VersionVector } from 'loro-crdt';
import * as v from 'valibot';
import { getMetadata, setMetadata } from './db';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const DUMMY_ENC_KEY = '8f55f2228b2926d1af83e4deb97c8532a579314f2bdd937aed972f0fe87e01af';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

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
        notesMetadata = LoroDoc.fromSnapshot(snapshotBytes);
        if (notesMetadataCaptured.updates) {
            const updatesBytes = decrypt(notesMetadataCaptured.updates);
            notesMetadata.import(updatesBytes);
        }
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
        pathsMetadata = LoroDoc.fromSnapshot(snapshotBytes);
        if (pathsMetadataCaptured.updates) {
            const updatesBytes = decrypt(pathsMetadataCaptured.updates);
            pathsMetadata.import(updatesBytes);
        }
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

    const { infos, index } = await refreshAllDirs(v);
    await setMetadata('paths', v);
    await setMetadata('paths_display', { metadata: infos, index });
    return infos;
};

export const getAllDirs = async () => {
    let pathsDisplayMetadata = (await getMetadata('paths_display'))?.metadata as Record<string, any>[];
    if (!pathsDisplayMetadata) {
        return await updatePathMetadata({ operationType: 'init' });
    }
    return pathsDisplayMetadata;
};

const refreshAllDirs = async (pathsMetadataCaptured: Record<string, any>) => {
    const snapshotBytes = decrypt(pathsMetadataCaptured.snapshot);
    const pathsMetadata = LoroDoc.fromSnapshot(snapshotBytes);
    if (pathsMetadataCaptured.updates) {
        const updatesBytes = decrypt(pathsMetadataCaptured.updates);
        pathsMetadata.import(updatesBytes);
    }

    const notesMetadataEncrypted = await getMetadata('notes');
    let notesMetadata: LoroMap | undefined = undefined;
    if (notesMetadataEncrypted) {
        const notesSnapshotBytes = decrypt(notesMetadataEncrypted.snapshot);
        const notesMetadataDoc = LoroDoc.fromSnapshot(notesSnapshotBytes);
        if (notesMetadataEncrypted.updates) {
            const updatesBytes = decrypt(notesMetadataEncrypted.updates);
            notesMetadataDoc.import(updatesBytes);
        }
        notesMetadata = notesMetadataDoc.getMap('note_metadata');
    }

    const pathsDisplayIndex = (await getMetadata('paths_display'))?.index || {};
    const pathTree = pathsMetadata.getTree('path_tree');
    const rootNode = pathTree.getNodes()[0];
    const res = dfsDirs(rootNode, 0, '', pathsDisplayIndex, notesMetadata);

    return res;
};

const dfsDirs = (
    node: LoroTreeNode,
    depth: number,
    prevPath: string,
    pathsDisplayIndex: Record<string, any>,
    notesMetadata?: LoroMap
) => {
    const folderName = node.data.get('name') as string;
    const fullPath = `${prevPath}${folderName}`;
    const prevIsOpen = pathsDisplayIndex[node.id]?.isOpen;
    const prevIsShow = pathsDisplayIndex[node.id]?.isShow;
    let parentIsOpen = true;
    if (prevIsOpen === undefined) {
        const parent = node.parent();
        parentIsOpen = parent ? pathsDisplayIndex[parent.id].isOpen : true;
    }
    const rootInfo: Record<string, any> = {
        name: folderName,
        nodeId: node.id,
        depth,
        fullPath: fullPath,
        isOpen: prevIsOpen === undefined ? true : prevIsOpen,
        isShow: prevIsShow === undefined ? parentIsOpen : prevIsShow,
    };
    let pathsIndex = { [node.id]: rootInfo };
    let childsInfo: Record<string, any>[] = [];

    node.children()?.forEach((c) => {
        const { infos, index } = dfsDirs(
            c,
            depth + 1,
            fullPath === '/' ? '' : fullPath,
            pathsDisplayIndex,
            notesMetadata
        );
        childsInfo = childsInfo.concat(infos);
        pathsIndex = { ...index, ...pathsIndex };
    });

    childsInfo.unshift(rootInfo);
    node.data
        .ensureMergeableList('notes')
        .toArray()
        .forEach((note) => {
            if (notesMetadata) {
                const titleContainer = notesMetadata.ensureMergeableMap(note as string).get('title');
                if (titleContainer) {
                    childsInfo.push({
                        noteId: note,
                        title: (titleContainer as LoroText).toString(),
                        depth: depth + 1,
                        fullPath,
                        isShow: rootInfo.isOpen,
                    });
                }
            }
        });
    return { infos: childsInfo, index: pathsIndex };
};

export const foldFolder = async (index: number) => {
    const m = await getMetadata('paths_display');
    const pathsDisplayMetadata = m?.metadata;
    const indexes = m?.index;
    if (!pathsDisplayMetadata) return;

    const refDepth = pathsDisplayMetadata[index].depth;
    pathsDisplayMetadata[index].isOpen = !pathsDisplayMetadata[index].isOpen;
    const parentFold: Record<number, boolean> = {
        [refDepth]: pathsDisplayMetadata[index].isOpen,
    };
    indexes[pathsDisplayMetadata[index].nodeId] = pathsDisplayMetadata[index];

    for (let i = index + 1; i < pathsDisplayMetadata.length; i++) {
        if (pathsDisplayMetadata[i].depth <= refDepth) {
            break;
        }
        pathsDisplayMetadata[i].isShow = parentFold[pathsDisplayMetadata[i].depth - 1];
        parentFold[pathsDisplayMetadata[i].depth] = pathsDisplayMetadata[i].isOpen && pathsDisplayMetadata[i].isShow;
        indexes[pathsDisplayMetadata[i].nodeId] = pathsDisplayMetadata[i];
    }

    await setMetadata('paths_display', { metadata: pathsDisplayMetadata, index: indexes });
};
