import { Component, Show } from 'solid-js';
import AuthGuard from '../auth_guard';
import { createForm, Field, Form, SubmitHandler } from '@formisch/solid';
import * as v from 'valibot';
import { TextInput } from '../components/TextInput';
import { $fetch, createNoteMetadata, encrypt } from '../../lib/util';
import { bytesToHex } from '@noble/ciphers/utils.js';
import { useNote } from './note-provider';

const CreateNoteSchema = v.object({
    title: v.pipe(v.string(), v.nonEmpty('Please enter note title')),
});

const NotesPage: Component = () => {
    const noteCtx = useNote();
    return (
        <AuthGuard>
            <div class="flex-1 flex flex-col items-center justify-center w-full min-h-screen">
                <div class="flex flex-col gap-4 w-full max-w-sm ">
                    <p>Create Note</p>
                    <CreateNoteForm />
                    <Show when={noteCtx.isLoadingMetadata()}>
                        <p>Loading....</p>
                    </Show>
                </div>
            </div>
        </AuthGuard>
    );
};

const CreateNoteForm = () => {
    const createNoteForm = createForm({
        schema: CreateNoteSchema,
    });

    const submitCreateNoteForm: SubmitHandler<typeof CreateNoteSchema> = async (values) => {
        const noteMetadata = createNoteMetadata({
            data: {
                title: values.title,
            },
            version: 1,
        }).export({ mode: 'snapshot' });

        const noteMetadataEnc = encrypt(noteMetadata);
        const noteMetadataEncHex = bytesToHex(noteMetadataEnc);
        const res = await $fetch('@post/notes', {
            headers: {
                'content-type': 'application/json',
            },
            body: {
                metadata: noteMetadataEncHex,
            },
        });
        console.log(res);
    };

    return (
        <Form of={createNoteForm} onSubmit={submitCreateNoteForm} class="flex flex-col gap-3">
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

export default NotesPage;
