import { FieldElementProps } from '@formisch/solid';
import { Component, splitProps } from 'solid-js';

interface TextInputProps extends FieldElementProps {
    type: 'text' | 'email' | 'password';
    label?: string;
    placeholder?: string;
    input: string | undefined;
    errors: [string, ...string[]] | null;
    required?: boolean;
}

export const TextInput: Component<TextInputProps> = (props) => {
    const [, inputProps] = splitProps(props, ['input', 'label', 'errors']);

    return (
        <div class="flex flex-col gap-2">
            {props.label && (
                <label for={props.name}>
                    {props.label}{' '}
                    {props.required && <span class="text-red-500">*</span>}
                </label>
            )}
            <input
                {...inputProps}
                id={props.name}
                value={props.input ?? ''}
                class="rounded-md p-2 border"
                aria-invalid={!!props.errors}
                aria-errormessage={`${props.name}-error`}
            />
            {props.errors && (
                <div id={`${props.name}-error`} class="text-red-300">
                    {props.errors[0]}
                </div>
            )}
        </div>
    );
};
