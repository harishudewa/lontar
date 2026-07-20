import { createFetch, createSchema } from '@better-fetch/fetch';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { hexToBytes, managedNonce } from '@noble/ciphers/utils.js';
import { LoroDoc, LoroText } from 'loro-crdt';
import * as v from 'valibot';

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

export type CreateNoteMetadataParams = CreateNoteMetadataParamsV1;
export type CreateNoteMetadataParamsV1 = {
    data: {
        title: string;
    };
    version: 1;
};

export const createNoteMetadata = (params: CreateNoteMetadataParams) => {
    const doc = new LoroDoc();
    const metadata = doc.getMap('note_metadata');

    if (params.version === 1) {
        const title = metadata.setContainer('title', new LoroText());
        title.insert(0, params.data.title);
    }

    return doc;
};

export const initializeMetadata = () => {
    const doc = new LoroDoc();
    const metadata = doc.getMap('metadata');

    // Paths
    const paths = metadata.ensureMergeableMap('paths');
    const rootDir = paths.ensureMergeableMap('/');
    rootDir.ensureMergeableList('notes');

    // Note metadata
    metadata.ensureMergeableMap('note_metadata');

    return doc;
};
