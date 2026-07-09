import { createSignal, Index } from 'solid-js';

const VirtualList = () => {
    const data = Array.from(Array(100), (_, k) => {
        return `data-${k}`;
    });
    const itemToRenderCount = 40;
    const expectedItemHeight = 24;
    const [startIndex, setStartIndex] = createSignal(0);

    return (
        <div
            class="h-[400px] overflow-auto mx-auto max-w-md w-full"
            onscroll={(e) => {
                const distance = e.currentTarget.scrollTop;
                console.log(
                    'scrolltop',
                    distance,
                    'startIndex',
                    Math.floor(distance / expectedItemHeight)
                );
            }}
        >
            <div class="h-[1000px] flex flex-col">
                <Index each={data}>
                    {(item, i) => {
                        return <p>{item()}</p>;
                    }}
                </Index>
            </div>
        </div>
    );
};

export default VirtualList;
