import { createForm, Field, Form, SubmitHandler } from '@formisch/solid';
import { setCookie } from '../../lib/util';
import AuthGuard from '../auth_guard';
import * as v from 'valibot';
import { TextInput } from '../components/TextInput';

const SignInSchema = v.object({
    username: v.pipe(v.string(), v.nonEmpty('Please enter your username')),
    password: v.pipe(v.string(), v.nonEmpty('Please enter your password')),
});

const signIn = () => {
    setCookie({
        key: '__access_token',
        value: 'gyugyu',
        secure: false,
        maxAge: 3600,
        path: '/',
        sameSite: 'Lax',
    });
};

const SignInPage = () => {
    return (
        <AuthGuard>
            <div class="flex min-h-screen flex-col w-full items-center justify-center ">
                <div class="max-w-sm w-full rounded-md border bg-zinc-900">
                    <div class="border-b p-4">
                        <h3 class="text-lg font-semibold">Welcome Back</h3>
                    </div>
                    <SigninForm />
                </div>
            </div>
        </AuthGuard>
    );
};

const SigninForm = () => {
    const signInForm = createForm({
        schema: SignInSchema,
    });

    const submitSignInForm: SubmitHandler<typeof SignInSchema> = (values) => {
        console.log(values);
    };

    return (
        <Form
            of={signInForm}
            onSubmit={submitSignInForm}
            class="flex flex-col gap-3 p-4"
        >
            <Field of={signInForm} path={['username']}>
                {(field) => (
                    <TextInput
                        {...field.props}
                        type="text"
                        label="Username"
                        input={field.input}
                        errors={field.errors}
                        placeholder="Enter your username"
                        required
                    />
                )}
            </Field>
            <Field of={signInForm} path={['password']}>
                {(field) => (
                    <TextInput
                        {...field.props}
                        type="password"
                        label="Password"
                        input={field.input}
                        errors={field.errors}
                        placeholder="Enter your password"
                        required
                    />
                )}
            </Field>
            <button
                class="bg-violet-200 text-gray-900 px-4 py-1.5 rounded-md mt-4"
                type="submit"
            >
                Sign In
            </button>
        </Form>
    );
};

export default SignInPage;
