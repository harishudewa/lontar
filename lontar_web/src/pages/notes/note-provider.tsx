import { Accessor, createContext, createSignal, ParentComponent, useContext } from 'solid-js';
import { getMetadata } from '../../lib/db';

export const NoteContext = createContext<{
    setIsNoteUpdated: (val: boolean) => void;
    isNoteUpdated: Accessor<boolean>;
    isLoadingMetadata: Accessor<boolean>;
}>();

const NoteProvider: ParentComponent = (props) => {
    const [isNoteUpdated, setIsNoteUpdated] = createSignal(false);
    const [isLoadingMetadata, setIsLoadingMetadata] = createSignal(true);

    getMetadata('metadata').then((v) => {
        setIsLoadingMetadata(false);
    });

    const state = {
        setIsNoteUpdated(val: boolean) {
            setIsNoteUpdated(val);
        },
        isNoteUpdated,
        isLoadingMetadata,
    };

    return <NoteContext.Provider value={state}>{props.children}</NoteContext.Provider>;
};

export const useNote = () => {
    const ctx = useContext(NoteContext);
    if (!ctx) {
        throw new Error("cant't find NoteContext");
    }
    return ctx;
};

export default NoteProvider;
