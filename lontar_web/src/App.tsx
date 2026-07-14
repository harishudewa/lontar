import { type Component } from 'solid-js';
import { Route, Router } from '@solidjs/router';
import SignInPage from './pages/signin/page';
import NotePage from './pages/notes/note/page';
import NotesLayout from './pages/notes/layout';
import VirtualList from './pages/notes/virtualist';

const App: Component = () => {
    return (
        <Router>
            <Route path="/signin" component={SignInPage} />
            <Route path="/" component={NotesLayout}>
                <Route path="/:noteId" component={NotePage} />
                <Route path="/virtual" component={VirtualList} />
            </Route>
        </Router>
    );
};

export default App;
