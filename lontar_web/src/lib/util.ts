import { createFetch, createSchema } from '@better-fetch/fetch';
import * as v from 'valibot';

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
    '/signin': {
        input: v.object({
            username: v.string(),
            password: v.string(),
        }),
        output: v.string(),
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
