import { useParams } from '@solidjs/router';
import { Component, ParentComponent } from 'solid-js';
import { getNote, setNote } from '../../lib/db';
import { bytesToHex, hexToBytes, managedNonce } from '@noble/ciphers/utils.js';
import { $fetch } from '../../lib/util';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { LoroDoc } from 'loro-crdt';
import { useNote } from './note-provider';

const DUMMY_ENC_KEY = '8f55f2228b2926d1af83e4deb97c8532a579314f2bdd937aed972f0fe87e01af';

const Navbar: Component = () => {
    const note = useNote();
    const params = useParams();

    const syncNote = async () => {
        const noteId = params.noteId;
        if (!noteId) return;

        const localNote = await getNote(noteId);
        if (!localNote || !localNote.version || !localNote.snapshot || !localNote.peerId) return;
        const localSnapshotEncryptedBytes = localNote.snapshot;

        const getNoteRes = await $fetch('@get/notes/:noteId', {
            params: {
                noteId,
            },
        });

        if (getNoteRes.error) {
            console.error(getNoteRes.error.message);
            return;
        }

        let localSnapshotEncryptedHex = bytesToHex(localSnapshotEncryptedBytes);

        if (getNoteRes.data.version >= localNote.version && getNoteRes.data.content) {
            console.log('starting');
            const key = hexToBytes(DUMMY_ENC_KEY);
            const chacha = managedNonce(xchacha20poly1305)(key);
            console.log('1');

            const localSnapshotDecryptedBytes = chacha.decrypt(localSnapshotEncryptedBytes);
            const localDoc = LoroDoc.fromSnapshot(localSnapshotDecryptedBytes);
            localDoc.setPeerId(localNote.peerId);
            console.log('2');

            const newSnapshotEncryptedBytes = hexToBytes(getNoteRes.data.content);
            const newSnapshotDecrypted = chacha.decrypt(newSnapshotEncryptedBytes);
            console.log('3');

            localDoc.import(newSnapshotDecrypted);
            console.log('4');

            const syncedSnapshotBytes = localDoc.export({ mode: 'snapshot' });
            const syncedSnapshotEncryptedBytes = chacha.encrypt(syncedSnapshotBytes);
            console.log('5');

            localNote.snapshot = syncedSnapshotEncryptedBytes;
            localNote.version = getNoteRes.data.version + 2;
            console.log('6');

            localSnapshotEncryptedHex = bytesToHex(syncedSnapshotEncryptedBytes);
            console.log('7');
        } else {
            localNote.version += 1;
        }

        const res = await $fetch('@patch/notes/:noteId', {
            params: {
                noteId,
            },
            headers: {
                'content-type': 'application/json',
            },
            body: {
                content: localSnapshotEncryptedHex,
            },
        });

        if (!res.error) {
            localNote.synced = true;
            setNote(noteId, localNote).then(() => {
                note.setIsNoteUpdated(true);
            });
        }

        console.log(res);
    };

    return (
        <nav class="w-full border-b h-10 px-4 flex items-center gap-4">
            <p>Nav</p>
            <button class="px-3 py-0.5 rounded-md bg-violet-500" onclick={syncNote}>
                Sync
            </button>
            {params.noteId}
        </nav>
    );
};

const NotesLayout: ParentComponent = ({ children }) => {
    return (
        <div class="flex flex-col w-full min-h-screen">
            <Navbar />
            {children}
        </div>
    );
};

export default NotesLayout;
