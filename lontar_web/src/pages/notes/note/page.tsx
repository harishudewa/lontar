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
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import { TreeCursor } from '@lezer/common';
import { Dynamic } from 'solid-js/web';
import { hashKey } from '../../../lib/util';
import remarkGfm from 'remark-gfm';

type DisplayMode = 'write' | 'preview' | 'split';

const highlighter = await createHighlighterCore({
    themes: [import('@shikijs/themes/vitesse-dark')],
    langs: [import('@shikijs/langs/typescript'), import('@shikijs/langs/rust')],
    engine: createOnigurumaEngine(() => import('shiki/wasm')),
});

const parseContent = (content: string) => {
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
            .processSync(content)
    );
};

const NotePage: Component = () => {
    let content = `# Heading 1
## Heading 2
### Heading 3
#### Heading 4

- list
  - another list
  - another
    - list

1. numbered list
   1. numbered list
   1. nested
      - another one here`;

    const [editorView, setEditorView] = createSignal<EditorView | undefined>(undefined);
    const [displayMode, setDisplayMode] = createSignal<DisplayMode>('split');
    const [currentNodes, setCurrentNodes] = createSignal<Component[]>([]);
    let prevComponents = new Map<string, number[]>();
    let currComponents = new Map<string, number[]>();

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.altKey) {
            switch (e.key) {
                case '1': {
                    content = editorView()?.state.doc.toString() || '';
                    setDisplayMode('write');
                    break;
                }
                case '2': {
                    setDisplayMode('preview');
                    break;
                }
                case '3': {
                    content = editorView()?.state.doc.toString() || '';
                    setDisplayMode('split');
                    break;
                }
            }
        }
    });

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
            return <div innerHTML={parseContent(text)}></div>;
        };
        return RenderComponent;
    };

    const handlePaste = (event: ClipboardEvent, view: EditorView) => {
        const files = event.clipboardData?.files;

        if (files && files.length > 0) {
            const imagePlaceholder = '<!-- Uploading image -->';
            const loadingText = `\n${imagePlaceholder}\n`;
            view.dispatch(view.state.replaceSelection(loadingText));

            new Promise((resolve) => {
                setTimeout(() => {
                    resolve(0);
                    const placeholderIndex = view.state.doc.toString().indexOf(imagePlaceholder);
                    if (placeholderIndex != -1) {
                        view.dispatch({
                            changes: {
                                from: placeholderIndex,
                                to: placeholderIndex + imagePlaceholder.length,
                                insert: 'Image uploaded.',
                            },
                        });
                    }
                }, 2000);
            });
        }
    };

    createEffect(
        on(
            () => displayMode(),
            (_, prevDisplayMode) => {
                if (!editorView() || prevDisplayMode === 'preview') {
                    const view = new EditorView({
                        doc: content,
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
                            }),
                            EditorView.contentAttributes.of({
                                spellcheck: 'false',
                                autocorrect: 'off',
                                autocapitalize: 'off',
                            }),
                            markdown(),
                        ],
                    });
                    setEditorView(view);
                }
            }
        )
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
