import { Component, createMemo, createSignal, createUniqueId, For, Match, Show, Switch } from 'solid-js';
import AuthGuard from '../auth_guard';
import { createForm, Field, Form, submit, SubmitHandler } from '@formisch/solid';
import * as v from 'valibot';
import { TextInput } from '../components/TextInput';
import { cn, foldFolder, getAllDirs, updateNoteMetadata, updatePathMetadata } from '../../lib/util';
import { TreeID } from 'loro-crdt';
import { createAsync, query, revalidate } from '@solidjs/router';
import { useMachine, normalizeProps } from '@zag-js/solid';
import IconChevronDown from 'lucide-solid/icons/chevron-down';
import IconChevronUp from 'lucide-solid/icons/chevron-up';
import IconEllipsis from 'lucide-solid/icons/ellipsis';
import IconDot from 'lucide-solid/icons/dot';
import * as menu from '@zag-js/menu';
import * as dialog from '@zag-js/dialog';
import { Portal } from 'solid-js/web';
import { v7 as uuidv7 } from 'uuid';

const CreateFolderSchema = v.object({
    name: v.pipe(v.string(), v.nonEmpty('Please enter folder name')),
});

const CreateNoteSchema = v.object({
    title: v.pipe(v.string(), v.nonEmpty('Please enter folder name')),
});

const NotesPage: Component = () => {
    return (
        <AuthGuard>
            <div class="flex-1 flex flex-col items-center justify-center w-full min-h-screen max-w-2xl mx-auto">
                <FolderSelect />
            </div>
        </AuthGuard>
    );
};

const CreateFolderForm: Component<{ nodeId: TreeID; fullPath: string }> = (props) => {
    const createFolderForm = createForm({
        schema: CreateFolderSchema,
    });

    const submitCreateFolderForm: SubmitHandler<typeof CreateFolderSchema> = async (values) => {
        await updatePathMetadata({
            operationType: 'createFolder',
            name: values.name,
            directParentFolderId: props.nodeId,
        });
        revalidate('get_all_dirs');
    };

    return (
        <Form of={createFolderForm} onSubmit={submitCreateFolderForm} class="flex flex-col gap-3">
            <span class="text-sm text-gray-400">Parent: {props.fullPath}</span>
            <Field of={createFolderForm} path={['name']}>
                {(field) => (
                    <TextInput
                        {...field.props}
                        type="text"
                        input={field.input}
                        errors={field.errors}
                        placeholder="Enter folder name"
                        required
                    />
                )}
            </Field>
            <div class="flex w-full justify-end">
                <button class="bg-gray-900 border rounded-md px-3 py-1 max-w-max" type="submit">
                    Create
                </button>
            </div>
        </Form>
    );
};

const CreateNoteForm: Component<{ nodeId: TreeID; fullPath: string }> = (props) => {
    const createNoteForm = createForm({
        schema: CreateNoteSchema,
    });

    const submitCreateNoteForm: SubmitHandler<typeof CreateNoteSchema> = async (values) => {
        const noteId = uuidv7();
        await updateNoteMetadata({ noteId, title: values.title });
        await updatePathMetadata({
            operationType: 'createNote',
            noteId,
            directParentFolderId: props.nodeId,
        });
        revalidate('get_all_dirs');
    };

    return (
        <Form of={createNoteForm} onSubmit={submitCreateNoteForm} class="flex flex-col gap-3">
            <span class="text-sm text-gray-400">Parent: {props.fullPath}</span>
            <Field of={createNoteForm} path={['title']}>
                {(field) => (
                    <TextInput
                        {...field.props}
                        type="text"
                        input={field.input}
                        errors={field.errors}
                        placeholder="Enter note title"
                        required
                    />
                )}
            </Field>
            <div class="flex w-full justify-end">
                <button class="bg-gray-900 border rounded-md px-3 py-1 max-w-max" type="submit">
                    Create
                </button>
            </div>
        </Form>
    );
};

const getAllDirsQuery = query(getAllDirs, 'get_all_dirs');

const FolderSelect = () => {
    const allDirs = createAsync(() => getAllDirsQuery());
    const foldF = async (i: number) => {
        await foldFolder(i);
        revalidate('get_all_dirs');
    };
    return (
        <div class="w-full border rounded-md bg-gray-900 overflow-x-auto">
            <div class="inline-block min-w-full align-top">
                <For each={allDirs()}>
                    {(item, i) => (
                        <Show when={item.isShow}>
                            <button
                                class="flex items-center gap-2 not-last:border-b py-1 px-2 w-full hover:bg-gray-950"
                                onClick={async (e) => {
                                    const isFoldZone = e.target.closest('[data-fold-zone]');
                                    if (e.target !== e.currentTarget && !isFoldZone) return;
                                    await foldF(i());
                                }}
                            >
                                <span
                                    class={cn(
                                        'sticky left-0 shrink-0 z-10 rounded-md p-1',
                                        item.nodeId && 'bg-gray-900'
                                    )}
                                    data-fold-zone
                                >
                                    <Show when={item.nodeId}>
                                        {item.isOpen ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />}
                                    </Show>
                                    <Show when={item.noteId}>
                                        <div class="size-4"></div>
                                    </Show>
                                </span>
                                <div class="whitespace-nowrap pr-8 flex items-center" data-fold-zone>
                                    <div class="flex gap-1 items-center pr-2">
                                        {new Array(item.depth).fill(0).map(() => (
                                            <span>
                                                <IconDot size={14} />
                                            </span>
                                        ))}
                                    </div>
                                    {item.name || item.title}
                                </div>
                                <FolderItemMenu
                                    type={item.noteId ? 'note' : 'dir'}
                                    nodeId={item.nodeId}
                                    fullPath={item.fullPath}
                                />
                            </button>
                        </Show>
                    )}
                </For>
            </div>
        </div>
    );
};

const ensureCallFunc = (fn: any, e: any) => {
    if (typeof fn !== 'function') return;
    fn(e);
};

const FolderItemMenu: Component<{ nodeId: TreeID; type: 'note' | 'dir'; fullPath: string }> = ({
    nodeId,
    fullPath,
}) => {
    const [isFormCreateFolderOpened, setIsFormCreateFolderOpened] = createSignal(false);
    const [isFormCreateNoteOpened, setIsFormCreateNoteOpened] = createSignal(false);
    const service = useMachine(menu.machine, () => ({
        id: createUniqueId(),
        onSelect(details) {
            if (details.value === 'create_folder') {
                setIsFormCreateFolderOpened(true);
            }
            if (details.value === 'create_note') {
                setIsFormCreateNoteOpened(true);
            }
        },
    }));
    const api = createMemo(() => menu.connect(service, normalizeProps));

    return (
        <>
            <FormDialog
                isOpen={isFormCreateFolderOpened()}
                nodeId={nodeId}
                onClose={() => setIsFormCreateFolderOpened(false)}
                fullPath={fullPath}
                type="createFolder"
            />
            <FormDialog
                isOpen={isFormCreateNoteOpened()}
                nodeId={nodeId}
                onClose={() => setIsFormCreateNoteOpened(false)}
                fullPath={fullPath}
                type="createNote"
            />
            <button
                {...api().getTriggerProps()}
                onClick={(e) => ensureCallFunc(api().getTriggerProps().onClick, e)}
                class="sticky right-3 ml-auto shrink-0 z-10 flex items-center justify-center bg-gray-900 p-1 rounded-md outline-none"
            >
                <IconEllipsis size={16} />
            </button>
            <div {...api().getPositionerProps()}>
                <div {...api().getContentProps()} class="border max-w-max rounded-md bg-gray-900 outline-none z-50">
                    <div {...api().getItemProps({ value: 'create_note' })} class="px-2 py-1 not-last:border-b">
                        Create Note
                    </div>
                    <div
                        {...api().getItemProps({ value: 'create_folder' })}
                        class="px-2 py-1 not-last:border-b"
                        onClick={(e) => ensureCallFunc(api().getItemProps({ value: 'create_folder' }).onClick, e)}
                    >
                        Create Folder
                    </div>
                </div>
            </div>
        </>
    );
};

const FormDialog: Component<{
    isOpen: boolean;
    nodeId: TreeID;
    onClose: () => void;
    fullPath: string;
    type: 'createNote' | 'createFolder';
}> = (props) => {
    const service = useMachine(dialog.machine, () => ({
        id: createUniqueId(),
        open: props.isOpen,
        onOpenChange(details) {
            if (!details.open) {
                props.onClose();
            }
        },
    }));
    const api = createMemo(() => dialog.connect(service, normalizeProps));

    return (
        <>
            <Show when={api().open}>
                <Portal>
                    <div {...api().getBackdropProps()} class="fixed inset-0 bg-black/50 z-40" />
                    <div {...api().getPositionerProps()} class="fixed inset-0 z-50 flex items-center justify-center">
                        <div
                            {...api().getContentProps()}
                            class="bg-gray-900 border rounded-md p-2 outline-none max-w-md w-full"
                        >
                            <Switch>
                                <Match when={props.type === 'createFolder'}>
                                    <CreateFolderForm nodeId={props.nodeId} fullPath={props.fullPath} />
                                </Match>
                                <Match when={props.type === 'createNote'}>
                                    <CreateNoteForm nodeId={props.nodeId} fullPath={props.fullPath} />
                                </Match>
                            </Switch>
                        </div>
                    </div>
                </Portal>
            </Show>
        </>
    );
};

export default NotesPage;
