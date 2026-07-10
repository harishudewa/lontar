/*
 *   - Paragraph con contain:
 *       - InlineCode
 *       - Link
 *   - BulletList / OrderedList items can contain:
 *       - Paragraph
 *       - Heading
 */

export type NodeType = 'Paragraph' | 'Code' | 'OrderedList' | 'BulletList' | 'InlineCode' | 'Heading' | 'Link' | 'Text';
export type HeadingDepth = 1 | 2 | 3 | 4;

export interface Node {
    id: string;
    nodeType: NodeType;
    from: number;
    to: number;
}

export class Text implements Node {
    id: string;
    content: string;
    nodeType: NodeType;
    from: number;
    to: number;

    constructor(id: string, content: string, from: number, to: number) {
        this.id = id;
        this.content = content;
        this.nodeType = 'Text';
        this.from = from;
        this.to = to;
    }
}

export class Heading implements Node {
    id: string;
    content: Node;
    depth: HeadingDepth;
    nodeType: NodeType;
    from: number;
    to: number;

    constructor(id: string, content: Node, depth: HeadingDepth, from: number, to: number) {
        this.id = id;
        this.content = content;
        this.depth = depth;
        this.nodeType = 'Heading';
        this.from = from;
        this.to = to;
    }
}

export class Paragraph implements Node {
    id: string;
    content: string;
    nodeType: NodeType;
    from: number;
    to: number;

    constructor(id: string, content: string, from: number, to: number) {
        this.id = id;
        this.content = content;
        this.nodeType = 'Paragraph';
        this.from = from;
        this.to = to;
    }
}

export class BulletList implements Node {
    id: string;
    items: Node[];
    nodeType: NodeType;
    from: number;
    to: number;

    constructor(id: string, items: Node[], from: number, to: number) {
        this.id = id;
        this.items = items;
        this.nodeType = 'BulletList';
        this.from = from;
        this.to = to;
    }
}

export class Code implements Node {
    id: string;
    content: string;
    nodeType: NodeType;
    from: number;
    to: number;

    constructor(id: string, content: string, from: number, to: number) {
        this.id = id;
        this.content = content;
        this.nodeType = 'Code';
        this.from = from;
        this.to = to;
    }
}

export class InlineCode implements Node {
    id: string;
    content: string;
    nodeType: NodeType;
    from: number;
    to: number;

    constructor(id: string, content: string, from: number, to: number) {
        this.id = id;
        this.content = content;
        this.nodeType = 'InlineCode';
        this.from = from;
        this.to = to;
    }
}

export class Link implements Node {
    id: string;
    url: string;
    label: string;
    nodeType: NodeType;
    from: number;
    to: number;

    constructor(id: string, url: string, label: string, from: number, to: number) {
        this.id = id;
        this.url = url;
        this.label = label;
        this.nodeType = 'Heading';
        this.from = from;
        this.to = to;
    }
}
