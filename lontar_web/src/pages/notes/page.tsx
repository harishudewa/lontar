import { Component } from 'solid-js';
import AuthGuard from '../auth_guard';
import { createForm, Field, Form, SubmitHandler } from '@formisch/solid';
import * as v from 'valibot';
import { TextInput } from '../components/TextInput';
import { v7 as uuidv7 } from 'uuid';
import { updateNoteMetadata, updatePathMetadata } from '../../lib/util';
import { TreeID } from 'loro-crdt';
import { getMetadata } from '../../lib/db';

const CreateNoteSchema = v.object({
    title: v.pipe(v.string(), v.nonEmpty('Please enter note title')),
    folderId: v.custom<TreeID>((input) => (typeof input === 'string' ? true : false)),
});

const NotesPage: Component = () => {
    getMetadata('paths').then((metadata) => {
        if (!metadata) {
            updatePathMetadata({ operationType: 'init' });
        }
    });

    return (
        <AuthGuard>
            <div class="flex-1 flex flex-col items-center justify-center w-full min-h-screen">
                <div class="flex flex-col gap-4 w-full max-w-sm ">
                    <p>Create Note</p>
                    <CreateNoteForm />
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
        const noteId = uuidv7();
        updateNoteMetadata({ noteId, title: values.title });
        updatePathMetadata({ operationType: 'createNote', directParentFolderId: `1@1`, noteId });
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
