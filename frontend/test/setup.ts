import { Window } from 'happy-dom';

const windowInstance = new Window();

globalThis.window = windowInstance as unknown as typeof globalThis.window;
globalThis.document = windowInstance.document as unknown as Document;
globalThis.navigator = windowInstance.navigator as unknown as Navigator;
globalThis.HTMLElement = windowInstance.HTMLElement as unknown as typeof HTMLElement;
globalThis.HTMLAnchorElement = windowInstance.HTMLAnchorElement as unknown as typeof HTMLAnchorElement;
globalThis.Node = windowInstance.Node as unknown as typeof Node;
globalThis.Text = windowInstance.Text as unknown as typeof Text;
globalThis.localStorage = windowInstance.localStorage as unknown as Storage;
globalThis.sessionStorage = windowInstance.sessionStorage as unknown as Storage;

Object.defineProperty(globalThis.document, 'cookie', {
  value: '',
  writable: true,
});
