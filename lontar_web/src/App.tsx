import { type Component } from 'solid-js';
import { Route, Router } from '@solidjs/router';
import SignInPage from './pages/signin/page';
import NotePage from './pages/notes/note/page';
import NotesLayout from './pages/notes/layout';
import NotesPage from './pages/notes/page';
import NoteProvider from './pages/notes/note-provider';

const App: Component = () => {
    return (
        <NoteProvider>
            <Router>
                <Route path="/signin" component={SignInPage} />
                <Route path="/" component={NotesPage} />
                <Route path="/notes" component={NotesLayout}>
                    <Route path="/:noteId" component={NotePage} />
                </Route>
            </Router>
        </NoteProvider>
    );
};

export default App;
