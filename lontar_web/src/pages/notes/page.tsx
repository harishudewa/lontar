import { Component } from 'solid-js';
import AuthGuard from '../auth_guard';
import { createForm, Field, Form, SubmitHandler } from '@formisch/solid';
import * as v from 'valibot';
import { TextInput } from '../components/TextInput';
import { $fetch } from '../../lib/util';
import { bytesToHex, hexToBytes, managedNonce } from '@noble/ciphers/utils.js';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';

const DUMMY_ENC_KEY = '8f55f2228b2926d1af83e4deb97c8532a579314f2bdd937aed972f0fe87e01af';

const CreateNoteSchema = v.object({
    title: v.pipe(v.string(), v.nonEmpty('Please enter note title')),
});

const NotesPage: Component = () => {
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
        const metadata = JSON.stringify({
            title: values.title,
        });
        const metadataBytes = new TextEncoder().encode(metadata);

        const key = hexToBytes(DUMMY_ENC_KEY);
        const chacha = managedNonce(xchacha20poly1305)(key);
        const metadataEnc = chacha.encrypt(metadataBytes);
        const metadataEncHex = bytesToHex(metadataEnc);
        const res = await $fetch('@post/notes', {
            headers: {
                'content-type': 'application/json',
            },
            body: {
                metadata: metadataEncHex,
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
