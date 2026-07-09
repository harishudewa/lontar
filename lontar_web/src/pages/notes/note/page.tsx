import { history, indentWithTab } from '@codemirror/commands';
import {
    drawSelection,
    EditorView,
    lineNumbers,
    keymap,
} from '@codemirror/view';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { createEffect, createSignal, on, Show, type Component } from 'solid-js';
import { unified } from 'unified';
import rehypeShikiFromHighlighter from '@shikijs/rehype/core';
import { createHighlighterCore } from 'shiki/core';
import { createOnigurumaEngine, HighlighterGeneric } from 'shiki';
import AuthGuard from '../../auth_guard';
import { Text } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import { TreeCursor } from '@lezer/common';

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
            .use(remarkRehype)
            .use(rehypeSanitize)
            .use(
                rehypeShikiFromHighlighter,
                highlighter as unknown as HighlighterGeneric<any, any>,
                {
                    theme: 'vitesse-dark',
                    inline: 'tailing-curly-colon',
                }
            )
            .use(rehypeStringify)
            .processSync(content)
    );
};

const NotePage: Component = () => {
    const initContent = `# Heading 1
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

    const [editorView, setEditorView] = createSignal<EditorView | undefined>(
        undefined
    );
    const [content, setContent] = createSignal(initContent);
    const [displayMode, setDisplayMode] = createSignal<DisplayMode>('split');

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

    let pending: number | undefined;
    const scheduleContentSync = (doc: Text) => {
        if (pending) clearTimeout(pending);
        pending = setTimeout(() => {
            setContent(doc.toString());
        }, 150);
    };

    const processSyntaxTree = (tree: TreeCursor, from: number, to: number) => {
        tree.moveTo(from);

        console.log(
            'init',
            'name',
            tree.name,
            'from',
            tree.from,
            'to',
            tree.to
        );

        while (tree.to < to && tree.parent()) {}

        console.log(
            'final',
            'name',
            tree.name,
            'from',
            tree.from,
            'to',
            tree.to
        );
    };

    createEffect(
        on(
            () => displayMode(),
            (_, prevDisplayMode) => {
                if (!editorView() || prevDisplayMode === 'preview') {
                    const view = new EditorView({
                        doc: content(),
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
                                    '&.cm-focused .cm-selectionBackground, ::selection':
                                        {
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
                            EditorView.updateListener.of((view) => {
                                if (view.docChanged) {
                                    const js: any[] = view.changes.toJSON();
                                    let start = 0;
                                    let end = view.state.doc.length;
                                    if (js[0] && typeof js[0] === 'number') {
                                        start = js[0];
                                    }
                                    if (js[1]) {
                                        if (js[1].length == 2) {
                                            end = start + js[1][1].length;
                                        } else {
                                            end = start;
                                        }
                                    }

                                    // console.log('change_set', js);
                                    console.log('start', start, 'end', end);
                                    processSyntaxTree(
                                        syntaxTree(view.startState).cursor(),
                                        start,
                                        end
                                    );
                                }
                                const str = view.state.doc;
                                scheduleContentSync(str);
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
                <Show
                    when={
                        displayMode() === 'write' || displayMode() === 'split'
                    }
                >
                    <div
                        id="editor"
                        class="w-full flex-1 p-4 pb-40 border-r h-[calc(100vh-2.5rem)] overflow-auto"
                    />
                </Show>
                <Show
                    when={
                        displayMode() === 'preview' || displayMode() === 'split'
                    }
                >
                    <div
                        class="w-full flex-1 p-4 pb-40 h-[calc(100vh-2.5rem)] overflow-auto note-content"
                        innerHTML={parseContent(content())}
                    />
                </Show>
            </div>
        </AuthGuard>
    );
};

export default NotePage;
