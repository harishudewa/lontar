import { ParentComponent } from 'solid-js';

const Navbar = () => {
    return (
        <nav class="w-full border-b h-10 px-4 flex items-center">
            <p>Nav</p>
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
