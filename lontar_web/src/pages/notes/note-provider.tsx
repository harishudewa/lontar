import { Accessor, createContext, createSignal, ParentComponent, useContext } from 'solid-js';

export const NoteContext = createContext<{
    setIsNoteUpdated: (val: boolean) => void;
    isNoteUpdated: Accessor<boolean>;
}>();

const NoteProvider: ParentComponent = (props) => {
    const [isNoteUpdated, setIsNoteUpdated] = createSignal(false);

    const state = {
        setIsNoteUpdated(val: boolean) {
            setIsNoteUpdated(val);
        },
        isNoteUpdated,
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
