import { ParentComponent } from 'solid-js';
import { getCookie } from '../lib/util';
import { useLocation, useNavigate } from '@solidjs/router';
import { useNote } from './notes/note-provider';

const AuthGuard: ParentComponent = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const note = useNote();

    const access_token = getCookie('__access_token');

    if (!access_token) {
        navigate('/signin');
    } else if (location.pathname.startsWith('/signin')) {
        navigate('/');
    }

    return <>{children}</>;
};

export default AuthGuard;
