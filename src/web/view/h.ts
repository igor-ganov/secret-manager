export type Props = {
  readonly attrs?: Readonly<Record<string, string>>;
  readonly on?: Readonly<Record<string, EventListener>>;
};

export type Child = string | Node;

export type H = (tag: string, props: Props, ...children: readonly Child[]) => HTMLElement;

/* Element builder bound to a document, so views stay pure functions of
   their inputs and unit tests can pass a happy-dom document. */
export const createH =
  (document: Document): H =>
  (tag, props, ...children) => {
    const element = document.createElement(tag);
    Object.entries(props.attrs ?? {}).forEach(([name, value]) => element.setAttribute(name, value));
    Object.entries(props.on ?? {}).forEach(([type, listener]) =>
      element.addEventListener(type, listener),
    );
    element.append(...children);
    return element;
  };
