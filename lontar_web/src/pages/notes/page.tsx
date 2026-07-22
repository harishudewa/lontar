import { Component, createMemo, createSignal, createUniqueId, For, on, Show } from 'solid-js';
import AuthGuard from '../auth_guard';
import { createForm, Field, Form, SubmitHandler } from '@formisch/solid';
import * as v from 'valibot';
import { TextInput } from '../components/TextInput';
import { foldFolder, getAllDirs, updatePathMetadata } from '../../lib/util';
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

const CreateFolderSchema = v.object({
    name: v.pipe(v.string(), v.nonEmpty('Please enter folder name')),
});

const NotesPage: Component = () => {
    const addFolder = async () => {
        await updatePathMetadata({
            operationType: 'createFolder',
            name: 'f4',
            directParentFolderId: '0@14871502425645395076',
        });
    };

    return (
        <AuthGuard>
            <div class="flex-1 flex flex-col items-center justify-center w-full min-h-screen max-w-2xl mx-auto">
                <FolderSelect />
            </div>
        </AuthGuard>
    );
};

const CreateFolderForm: Component<{ nodeId: TreeID }> = (props) => {
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
            <Field of={createFolderForm} path={['name']}>
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
                                class="flex items-center gap-2 not-last:border-b py-1 px-2 w-full hover:not-has-[:hover]:bg-gray-950"
                                onClick={async () => await foldF(i())}
                            >
                                <span class="sticky left-0 shrink-0 z-10 bg-gray-900 pr-1">
                                    {item.isOpen ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />}
                                </span>
                                <div class="whitespace-nowrap pr-8 flex items-center">
                                    <div class="flex gap-1 items-center pr-2">
                                        {new Array(item.depth).fill(0).map(() => (
                                            <span>
                                                <IconDot size={14} />
                                            </span>
                                        ))}
                                    </div>
                                    {item.name}
                                </div>
                                <FolderItemMenu type="dir" nodeId={item.nodeId} />
                            </button>
                        </Show>
                    )}
                </For>
            </div>
        </div>
    );
};

const withStopPropagation = (handler: any) => (e: MouseEvent) => {
    e.stopPropagation();
    handler?.(e);
};

const FolderItemMenu: Component<{ nodeId: TreeID; type: 'dir' | 'file' }> = ({ nodeId }) => {
    const [isFormCreateFolderOpened, setIsFormCreateFolderOpened] = createSignal(false);
    const service = useMachine(menu.machine, () => ({
        id: createUniqueId(),
        onSelect(details) {
            if (details.value === 'create_folder') {
                setIsFormCreateFolderOpened(true);
            }
        },
    }));
    const api = createMemo(() => menu.connect(service, normalizeProps));

    return (
        <>
            <CreateFolderDialog
                isOpen={isFormCreateFolderOpened()}
                nodeId={nodeId}
                onClose={() => setIsFormCreateFolderOpened(false)}
            />
            <button
                {...api().getTriggerProps()}
                onClick={withStopPropagation(api().getTriggerProps().onClick)}
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
                        onClick={withStopPropagation(api().getItemProps({ value: 'create_folder' }).onClick)}
                    >
                        Create Folder
                    </div>
                </div>
            </div>
        </>
    );
};

const CreateFolderDialog: Component<{ isOpen: boolean; nodeId: TreeID; onClose: () => void }> = (props) => {
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
                            <CreateFolderForm nodeId={props.nodeId} />
                        </div>
                    </div>
                </Portal>
            </Show>
        </>
    );
};

// const FolderSelectWithComponent = () => {
//     const allDirs = createAsync(() => getAllDirsQuery());
//     const collection = createMemo(() =>
//         select.collection({
//             items: allDirs() || [],
//             itemToString(item) {
//                 return item.fullPath;
//             },
//             itemToValue(item) {
//                 return item.nodeId;
//             },
//         })
//     );
//
//     const service = useMachine(select.machine, () => ({
//         id: createUniqueId(),
//         positioning: {
//             sameWidth: true,
//         },
//         collection: collection(),
//     }));
//
//     const api = createMemo(() => select.connect(service, normalizeProps));
//
//     return (
//         <div>
//             <div class="flex flex-col">
//                 <label {...api().getLabelProps()}>Select Folder</label>
//                 <button {...api().getTriggerProps()} class="border text-left p-2 rounded-md">
//                     {api().valueAsString || 'Nothing selected'}
//                 </button>
//             </div>
//
//             <div {...api().getPositionerProps()} class="bg-gray-900">
//                 <div
//                     {...api().getContentProps()}
//                     class="flex flex-col w-full overflow-x-auto border rounded-md max-h-32 oveflowy-y-auto"
//                 >
//                     <For each={allDirs()}>
//                         {(item) => (
//                             <div
//                                 {...api().getItemProps({ item })}
//                                 style={{ 'padding-left': `${item.depth * 10 + 4}px` }}
//                                 class="w-full text-left not-last:border-b py-1 cursor-pointer hover:bg-gray-950"
//                             >
//                                 {item.name}
//                             </div>
//                         )}
//                     </For>
//                 </div>
//             </div>
//         </div>
//     );
// };

export default NotesPage;
