import { history, indentWithTab } from '@codemirror/commands';
import { drawSelection, EditorView, lineNumbers, keymap } from '@codemirror/view';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { createEffect, createSignal, For, on, Show, type Component } from 'solid-js';
import { unified } from 'unified';
import rehypeShikiFromHighlighter from '@shikijs/rehype/core';
import { createHighlighterCore } from 'shiki/core';
import { createOnigurumaEngine, HighlighterGeneric } from 'shiki';
import AuthGuard from '../../auth_guard';
import { ChangeSet, EditorState, Text } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import { TreeCursor } from '@lezer/common';
import { Dynamic } from 'solid-js/web';
import { $fetch, hashKey } from '../../../lib/util';
import remarkGfm from 'remark-gfm';
import type { Root } from 'hast';
import { visit } from 'unist-util-visit';
import { hexToBytes, managedNonce } from '@noble/ciphers/utils.js';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { getImage, getNote, setImage, setNote } from '../../../lib/db';
import { useParams } from '@solidjs/router';
import { Frontiers, LoroDoc, VersionVector } from 'loro-crdt';

type DisplayMode = 'write' | 'preview' | 'split';

const highlighter = await createHighlighterCore({
    themes: [import('@shikijs/themes/vitesse-dark')],
    langs: [import('@shikijs/langs/typescript'), import('@shikijs/langs/rust')],
    engine: createOnigurumaEngine(() => import('shiki/wasm')),
});

// const DUMMY_ENC_KEY = '8f55f2228b2926d1af83e4deb97c8532a579314f2bdd937aed972f0fe87e01af';
const DUMMY_ENC_KEY = '8f55f2228b2926d1af83e4deb97c8532a579314f2bdd937aed972f0fe87e01af';

const NotePage: Component = () => {
    const params = useParams();
    const [displayMode, setDisplayMode] = createSignal<DisplayMode>('split');
    const [currentNodes, setCurrentNodes] = createSignal<Component[]>([]);
    const [isChangedImages, setIsChangedImages] = createSignal(false);
    const [initNoteContent, setInitNoteContent] = createSignal<string | undefined>(undefined);
    let changedImages: Record<string, string[]> = {};
    let loroDoc = new LoroDoc();
    let latestVersion: VersionVector | undefined = undefined;
    let peerId = 0;

    let prevComponents = new Map<string, number[]>();
    let currComponents = new Map<string, number[]>();

    createEffect(
        on(isChangedImages, () => {
            for (const [_, imgs] of Object.entries(changedImages)) {
                for (const img of imgs) {
                    try {
                        const imgEl = document.querySelectorAll(`#${img}`);
                        for (const [_, el] of imgEl.entries()) {
                            let src = img;
                            if (img === 'juun') {
                                src = 'https://i.pinimg.com/736x/ca/19/10/ca1910b8b22f9136f8e55d1f8281a609.jpg';
                            } else if (img === 'jiwoo') {
                                src = 'https://i.pinimg.com/736x/ba/b5/d7/bab5d7e78575aad93081fe4777c1ecc8.jpg';
                            } else if (img === 'ian') {
                                src = 'https://i.pinimg.com/1200x/c2/5e/2f/c25e2f4138cb824ababf13e967036146.jpg';
                            } else {
                                getImage(img).then((val) => {
                                    const key = hexToBytes(DUMMY_ENC_KEY);
                                    const chacha = managedNonce(xchacha20poly1305)(key);
                                    const imgData = chacha.decrypt(val);
                                    src = URL.createObjectURL(new Blob([imgData]));
                                    (el as HTMLImageElement).src = src;
                                    (el as HTMLImageElement).onload = () => {
                                        URL.revokeObjectURL(src);
                                    };
                                });
                            }
                            (el as HTMLImageElement).src = src;
                        }
                    } catch (e) {
                        // do nothing
                    }
                }
            }
        })
    );

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.altKey) {
            switch (e.key) {
                case '1': {
                    setDisplayMode('write');
                    break;
                }
                case '2': {
                    setDisplayMode('preview');
                    break;
                }
                case '3': {
                    setDisplayMode('split');
                    break;
                }
            }
        }
    });

    getNote(params.noteId || 'newNote').then((note) => {
        if (note) {
            loroDoc = LoroDoc.fromSnapshot(note.loroBytes);
            loroDoc.setPeerId(note.peerId);
            const lText = loroDoc.getText('content');
            setInitNoteContent(lText.toString());
        } else {
            setInitNoteContent('');
        }
        latestVersion = loroDoc.oplogVersion();
        console.log('latestVersion', latestVersion);
    });

    let pendingItems: Record<string, number> = {};
    const processChangedImages = (imgs: string[], hashKey: string) => {
        if (pendingItems[hashKey]) clearTimeout(pendingItems[hashKey]);
        pendingItems[hashKey] = setTimeout(() => {
            changedImages[hashKey] = imgs;
            setIsChangedImages(!isChangedImages());
        }, 750);
    };

    const parseContent = (content: string, hashKey: string) => {
        return String(
            unified()
                .use(remarkParse)
                .use(remarkGfm)
                .use(remarkRehype)
                .use(rehypeSanitize)
                .use(rehypeShikiFromHighlighter, highlighter as unknown as HighlighterGeneric<any, any>, {
                    theme: 'vitesse-dark',
                    inline: 'tailing-curly-colon',
                })
                .use(rehypeStringify)
                .use(() => {
                    return (tree: Root) => {
                        const imgs: string[] = [];
                        visit(tree, 'element', (node) => {
                            if (node.tagName === 'img' && node.properties.src) {
                                imgs.push(node.properties.src);
                                node.properties.id = node.properties.src;
                                processChangedImages(imgs, hashKey);
                            }
                        });
                    };
                })
                .processSync(content)
        );
    };

    const processChanges = (currState: EditorState) => {
        const currStateTree = syntaxTree(currState);

        const newNodes: Component[] = [];
        const cursor = currStateTree.cursor();
        let ok = cursor.firstChild();

        let idx = 0;
        while (ok) {
            const name = cursor.node.name,
                from = cursor.node.from,
                to = cursor.node.to;
            const key = hashKey(`${name}:${currState.doc.sliceString(from, to + 1)}`);

            const prevComponentIndexes = prevComponents.get(key) || [];
            if (prevComponentIndexes.length > 0) {
                const i = prevComponentIndexes.shift() as number;
                newNodes.push(currentNodes()[i]);
                currComponents.set(key, [...(currComponents.get(key) || []), idx]);
            } else {
                newNodes.push(processComponent(cursor, key, idx, currState));
            }

            ok = cursor.nextSibling();
            idx += 1;
        }

        prevComponents = currComponents;
        currComponents = new Map();
        setCurrentNodes(newNodes);
    };

    const processComponent = (cursor: TreeCursor, key: string, idx: number, state: EditorState) => {
        currComponents.set(key, [...(currComponents.get(key) || []), idx]);
        const text = state.doc.sliceString(cursor.node.from, cursor.node.to);
        const RenderComponent: Component = () => {
            return <div innerHTML={parseContent(text, `${key}:${idx}`)}></div>;
        };
        return RenderComponent;
    };

    const handlePaste = (event: ClipboardEvent, view: EditorView) => {
        const files = event.clipboardData?.files;

        if (files && files.length > 0) {
            const imagePlaceholder = '<!-- Uploading image -->';
            const loadingText = `\n${imagePlaceholder}\n\n`;
            view.dispatch(view.state.replaceSelection(loadingText));

            // try encrypt-decrypt
            const key = hexToBytes(DUMMY_ENC_KEY);
            const chacha = managedNonce(xchacha20poly1305)(key);
            files[0].bytes().then((val) => {
                const encImgData = chacha.encrypt(val);
                $fetch('@post/images', {
                    headers: {
                        'content-type': 'application/octet-stream',
                    },
                    body: encImgData,
                }).then((val) => {
                    if (val.data) {
                        const placeholderIndex = view.state.doc.toString().indexOf(imagePlaceholder);
                        setImage(val.data.obj_key, encImgData).then(() => {
                            if (placeholderIndex != -1) {
                                view.dispatch({
                                    changes: {
                                        from: placeholderIndex,
                                        to: placeholderIndex + imagePlaceholder.length,
                                        insert: `![${val.data.obj_key}](${val.data.obj_key})`,
                                    },
                                });
                            }
                        });
                    } else {
                        console.error(val.error);
                    }
                });
            });
        }
    };

    const storeChanges = (changeSet: ChangeSet, prevState: EditorState, noteId: string) => {
        getNote(noteId).then((val) => {
            let v: Record<string, any> = val;
            if (!val) {
                v = {
                    changeSet: changeSet.toJSON(),
                    baseContent: prevState.doc.toString(),
                    loroBytes: loroDoc.export({ mode: 'shallow-snapshot', frontiers: loroDoc.frontiers() }),
                    loroPendingStoreBytes: loroDoc.export({ mode: 'update', from: latestVersion }),
                    peerId: loroDoc.peerId,
                };
            } else {
                // v.changeSet = ChangeSet.fromJSON(val.changeSet).compose(changeSet).toJSON();
            }
            changeSet.iterChanges((fromA, toA, fromB, toB, inserted) => {
                // Loro
                const loroText = loroDoc.getText('content');
                console.log(fromA, toA, fromB, toB, inserted);
                if (fromA != toA) {
                    loroText.delete(fromA, toA - fromA);
                }
                if (fromB != toB) {
                    loroText.insert(fromB, inserted.toString());
                }
                v.loroBytes = loroDoc.export({ mode: 'snapshot' });
                v.loroPendingStoreBytes = loroDoc.export({ mode: 'update', from: latestVersion });
            });

            setNote(params.noteId || '', v);
        });
    };

    createEffect(
        on(initNoteContent, (note) => {
            if (note !== undefined) {
                const view = new EditorView({
                    doc: note,
                    parent: document.querySelector('#editor') || undefined,
                    extensions: [
                        lineNumbers(),
                        history(),
                        drawSelection(),
                        EditorView.lineWrapping,
                        keymap.of([indentWithTab]),
                        EditorView.theme(
                            {
                                '&': {
                                    color: 'white',
                                    backgroundColor: '#020202',
                                },
                                '.cm-content': {
                                    caretColor: '#0e9',
                                },
                                '&.cm-focused .cm-cursor': {
                                    borderLeftColor: '#0e9',
                                },
                                '&.cm-focused .cm-selectionBackground, ::selection': {
                                    backgroundColor: '#074',
                                },
                                '.cm-gutters': {
                                    backgroundColor: '#353535',
                                    color: '#ddd',
                                    border: 'none',
                                },
                            },
                            { dark: true }
                        ),
                        EditorView.domEventHandlers({
                            paste: handlePaste,
                        }),
                        EditorView.updateListener.of((view) => {
                            if (view.docChanged || currentNodes().length === 0) {
                                processChanges(view.state);
                            }
                            if (view.docChanged) {
                                storeChanges(view.changes, view.startState, params.noteId || 'new');
                            }
                        }),
                        EditorView.contentAttributes.of({
                            spellcheck: 'false',
                            autocorrect: 'off',
                            autocapitalize: 'off',
                        }),
                        markdown(),
                    ],
                });
            }
        })
    );

    return (
        <AuthGuard>
            <div class="flex w-full mx-auto flex-1">
                <Show when={displayMode() === 'write' || displayMode() === 'split'}>
                    <div id="editor" class="w-full flex-1 p-4 pb-40 border-r h-[calc(100vh-2.5rem)] overflow-auto" />
                </Show>
                <Show when={displayMode() === 'preview' || displayMode() === 'split'}>
                    <div class="w-full flex-1 p-4 pb-40 h-[calc(100vh-2.5rem)] overflow-auto note-content">
                        <For each={currentNodes()}>{(el) => <Dynamic component={el} />}</For>
                    </div>
                </Show>
            </div>
        </AuthGuard>
    );
};

export default NotePage;
